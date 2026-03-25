use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use crate::error::{AppError, AppResult};

/// シンプルなコマンド実行結果
pub struct RunOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

impl RunOutput {
    pub fn success(&self) -> bool {
        self.exit_code == Some(0)
    }
}

/// コマンドを実行して stdout/stderr を収集する
pub async fn run_command(program: &str, args: &[&str]) -> AppResult<RunOutput> {
    let output = Command::new(program)
        .args(args)
        .kill_on_drop(true)
        .output()
        .await?;

    Ok(RunOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
    })
}

/// stderr をリアルタイムで読み取りながらコマンドを実行する
/// on_line: 各行を受け取るコールバック
/// cancel_rx: キャンセル信号 (Some で送信するとプロセスをkill)
pub async fn run_with_stderr_stream<F>(
    program: &str,
    args: &[&str],
    on_line: F,
    cancel_rx: Option<tokio::sync::oneshot::Receiver<()>>,
) -> AppResult<RunOutput>
where
    F: Fn(String) + Send + Sync + 'static,
{
    let mut child = Command::new(program)
        .args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()?;

    let stderr = child.stderr.take().expect("stderr should be piped");
    let stdout = child.stdout.take().expect("stdout should be piped");

    // stderr をバックグラウンドで読み取る
    let stderr_task = tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        let mut collected = String::new();
        while let Ok(Some(line)) = lines.next_line().await {
            on_line(line.clone());
            if !collected.is_empty() {
                collected.push('\n');
            }
            collected.push_str(&line);
        }
        collected
    });

    // stdout を収集する
    let stdout_task = tokio::spawn(async move {
        let mut buf = String::new();
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if !buf.is_empty() {
                buf.push('\n');
            }
            buf.push_str(&line);
        }
        buf
    });

    // キャンセル処理
    if let Some(rx) = cancel_rx {
        tokio::select! {
            _ = rx => {
                child.kill().await.ok();
                stderr_task.abort();
                stdout_task.abort();
                return Err(AppError::Cancelled);
            }
            status = child.wait() => {
                let exit_code = status?.code();
                let stderr_out = stderr_task.await.unwrap_or_default();
                let stdout_out = stdout_task.await.unwrap_or_default();
                return Ok(RunOutput { stdout: stdout_out, stderr: stderr_out, exit_code });
            }
        }
    }

    let status = child.wait().await?;
    let exit_code = status.code();
    let stderr_out = stderr_task.await.unwrap_or_default();
    let stdout_out = stdout_task.await.unwrap_or_default();

    Ok(RunOutput {
        stdout: stdout_out,
        stderr: stderr_out,
        exit_code,
    })
}

/// プロセスを PID で強制終了する
pub fn kill_process(pid: u32) -> AppResult<()> {
    #[cfg(unix)]
    {
        use std::process::Command as StdCommand;
        StdCommand::new("kill")
            .args(["-9", &pid.to_string()])
            .output()?;
    }
    #[cfg(windows)]
    {
        use std::process::Command as StdCommand;
        StdCommand::new("taskkill")
            .args(["/F", "/PID", &pid.to_string()])
            .output()?;
    }
    Ok(())
}
