use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::{oneshot, watch, Mutex};

use crate::config;
use crate::error::{AppError, AppResult};
use crate::models::ffmpeg::JobProgress;
use crate::models::media::StreamType;
use crate::platform;
use crate::services::{ffmpeg_service, process_manager};

// ── パラメータ ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiUpscaleParams {
    pub input_path:    String,
    pub output_path:   String,
    /// "realesr-animevideov3" | "realesrgan-x4plus" | "realesrgan-x4plus-anime"
    pub model:         String,
    /// 2 | 3 | 4
    pub scale:         u32,
    /// 最終的に Lanczos でリサイズして合わせたい解像度（任意）
    pub target_width:  Option<u32>,
    pub target_height: Option<u32>,
    /// 出力動画の映像コーデック（"libx264" 等）
    pub video_codec:   String,
    /// CRF（指定しない場合は18相当）
    pub crf:           Option<u32>,
}

// ── 進捗パーサー ──────────────────────────────────────────────────────────────

/// Real-ESRGAN-ncnn-vulkan の stderr 行から進捗を取り出す。
/// 例: "12.50%" → Some(12.5) / "done" → None
pub fn parse_realesrgan_progress(line: &str) -> Option<f64> {
    let trimmed = line.trim();
    let pct = trimmed.strip_suffix('%')?;
    pct.trim().parse::<f64>().ok()
}

// ── キャンセル伝搬 ────────────────────────────────────────────────────────────

/// watch::Receiver を oneshot::Receiver にブリッジする
fn watch_to_oneshot(mut rx: watch::Receiver<bool>) -> oneshot::Receiver<()> {
    let (tx, orx) = oneshot::channel();
    tokio::spawn(async move {
        loop {
            if *rx.borrow() {
                let _ = tx.send(());
                return;
            }
            if rx.changed().await.is_err() {
                return;
            }
        }
    });
    orx
}

// ── 一時ディレクトリ ──────────────────────────────────────────────────────────

fn job_temp_dir(job_id: &str) -> PathBuf {
    config::temp_dir().join(format!("upscale_{job_id}"))
}

fn cleanup_dir(dir: &PathBuf) {
    let _ = std::fs::remove_dir_all(dir);
}

// ── メインパイプライン ────────────────────────────────────────────────────────

pub async fn run_ai_upscale(
    app: AppHandle,
    job_id: String,
    params: AiUpscaleParams,
    cancel_rx: oneshot::Receiver<()>,
) -> AppResult<String> {
    // バイナリ存在チェック
    let ffmpeg_bin = platform::ffmpeg_path();
    let esrgan_bin = platform::realesrgan_path();
    let models_dir = platform::realesrgan_models_dir();

    if !ffmpeg_bin.exists() {
        return Err(AppError::BinaryNotFound { tool: "ffmpeg".into() });
    }
    if !esrgan_bin.exists() {
        return Err(AppError::BinaryNotFound { tool: "realesrgan-ncnn-vulkan".into() });
    }
    if !models_dir.exists() {
        return Err(AppError::BinaryNotFound { tool: "realesrgan-models".into() });
    }

    // 入力情報取得 (FPS, duration)
    let media = ffmpeg_service::probe_media(&params.input_path).await?;
    let duration = media.duration;
    let fps = media
        .streams
        .iter()
        .find(|s| matches!(s.stream_type, StreamType::Video))
        .and_then(|s| s.fps)
        .unwrap_or(30.0);

    // 一時ディレクトリ作成
    let tmp = job_temp_dir(&job_id);
    let frames_dir = tmp.join("frames");
    let upscaled_dir = tmp.join("upscaled");
    std::fs::create_dir_all(&frames_dir).map_err(AppError::Io)?;
    std::fs::create_dir_all(&upscaled_dir).map_err(AppError::Io)?;

    // 外側 cancel_rx → 各フェーズ用 watch にブリッジ
    let (cancel_watch_tx, cancel_watch_rx) = watch::channel(false);
    tokio::spawn(async move {
        let _ = cancel_rx.await;
        let _ = cancel_watch_tx.send(true);
    });

    // 全フェーズを通した進捗を job:progress:{job_id} で通知するヘルパ
    let app_progress = app.clone();
    let job_id_progress = job_id.clone();
    let emit_overall = move |percent: f64| {
        let progress = JobProgress {
            percent,
            frame: 0,
            fps: 0.0,
            bitrate: String::new(),
            total_size: 0,
            current_time: 0.0,
            speed: String::new(),
            eta: None,
        };
        let _ = app_progress.emit(&format!("job:progress:{job_id_progress}"), progress);
    };
    let emit_overall = Arc::new(Mutex::new(emit_overall));

    // ── Phase 1: フレーム抽出 (0% → 15%) ──────────────────────────────────────
    {
        let frame_pattern = frames_dir.join("frame_%08d.png");
        let args: Vec<String> = vec![
            "-y".into(),
            "-i".into(), params.input_path.clone(),
            "-vsync".into(), "0".into(),
            "-pix_fmt".into(), "rgb24".into(),
            frame_pattern.to_string_lossy().to_string(),
        ];
        let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

        let app_inner = app.clone();
        let jid = job_id.clone();
        let dur = duration;
        let on_line = move |line: String| {
            if let Some(p) = ffmpeg_service::parse_ffmpeg_progress(&line, dur) {
                let scaled = (p.percent / 100.0) * 15.0;
                let mut p = p.clone();
                p.percent = scaled;
                let _ = app_inner.emit(&format!("job:progress:{jid}"), p);
            }
        };

        let phase_cancel = watch_to_oneshot(cancel_watch_rx.clone());
        let result = process_manager::run_with_stderr_stream(
            &ffmpeg_bin.to_string_lossy(),
            &str_args,
            on_line,
            Some(phase_cancel),
        )
        .await;

        match result {
            Err(AppError::Cancelled) => {
                cleanup_dir(&tmp);
                emit_job_error(&app, &job_id, "キャンセルされました", "");
                return Err(AppError::Cancelled);
            }
            Err(e) => {
                cleanup_dir(&tmp);
                let msg = e.to_string();
                emit_job_error(&app, &job_id, &msg, "");
                return Err(e);
            }
            Ok(out) if !out.success() => {
                cleanup_dir(&tmp);
                let msg = format!("FFmpegフレーム抽出に失敗 (exit {:?})", out.exit_code);
                emit_job_error(&app, &job_id, &msg, &out.stderr);
                return Err(AppError::FFmpeg { message: msg, stderr: out.stderr });
            }
            Ok(_) => {}
        }
    }

    (emit_overall.lock().await)(15.0);

    // ── Phase 2: Real-ESRGAN アップスケール (15% → 85%) ──────────────────────
    {
        let args: Vec<String> = vec![
            "-i".into(), frames_dir.to_string_lossy().to_string(),
            "-o".into(), upscaled_dir.to_string_lossy().to_string(),
            "-n".into(), params.model.clone(),
            "-s".into(), params.scale.to_string(),
            "-f".into(), "png".into(),
        ];
        let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

        let app_inner = app.clone();
        let jid = job_id.clone();
        let on_line = move |line: String| {
            if let Some(p) = parse_realesrgan_progress(&line) {
                let overall = 15.0 + (p / 100.0) * 70.0;
                let progress = JobProgress {
                    percent: overall,
                    frame: 0,
                    fps: 0.0,
                    bitrate: String::new(),
                    total_size: 0,
                    current_time: 0.0,
                    speed: String::new(),
                    eta: None,
                };
                let _ = app_inner.emit(&format!("job:progress:{jid}"), progress);
            }
        };

        let phase_cancel = watch_to_oneshot(cancel_watch_rx.clone());
        let result = process_manager::run_with_stderr_stream(
            &esrgan_bin.to_string_lossy(),
            &str_args,
            on_line,
            Some(phase_cancel),
        )
        .await;

        match result {
            Err(AppError::Cancelled) => {
                cleanup_dir(&tmp);
                emit_job_error(&app, &job_id, "キャンセルされました", "");
                return Err(AppError::Cancelled);
            }
            Err(e) => {
                cleanup_dir(&tmp);
                let msg = e.to_string();
                emit_job_error(&app, &job_id, &msg, "");
                return Err(e);
            }
            Ok(out) if !out.success() => {
                cleanup_dir(&tmp);
                let msg = format!("Real-ESRGAN処理に失敗 (exit {:?})", out.exit_code);
                emit_job_error(&app, &job_id, &msg, &out.stderr);
                return Err(AppError::FFmpeg { message: msg, stderr: out.stderr });
            }
            Ok(_) => {}
        }
    }

    (emit_overall.lock().await)(85.0);

    // ── Phase 3: 再エンコード + 音声マージ (85% → 100%) ──────────────────────
    {
        let crf = params.crf.unwrap_or(18).to_string();
        let upscaled_pattern = upscaled_dir.join("frame_%08d.png");

        let mut args: Vec<String> = vec![
            "-y".into(),
            "-framerate".into(), format!("{fps}"),
            "-i".into(), upscaled_pattern.to_string_lossy().to_string(),
            "-i".into(), params.input_path.clone(),
            "-map".into(), "0:v:0".into(),
            "-map".into(), "1:a?".into(),
            "-c:v".into(), params.video_codec.clone(),
            "-crf".into(), crf,
            "-pix_fmt".into(), "yuv420p".into(),
            "-c:a".into(), "copy".into(),
            "-shortest".into(),
        ];

        // 目標解像度が指定されていればLanczosでフィット
        if let (Some(w), Some(h)) = (params.target_width, params.target_height) {
            args.push("-vf".into());
            args.push(format!("scale={w}:{h}:flags=lanczos"));
        }

        args.push(params.output_path.clone());

        let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

        let app_inner = app.clone();
        let jid = job_id.clone();
        let dur = duration;
        let on_line = move |line: String| {
            if let Some(p) = ffmpeg_service::parse_ffmpeg_progress(&line, dur) {
                let scaled = 85.0 + (p.percent / 100.0) * 15.0;
                let mut p = p.clone();
                p.percent = scaled;
                let _ = app_inner.emit(&format!("job:progress:{jid}"), p);
            }
        };

        let phase_cancel = watch_to_oneshot(cancel_watch_rx.clone());
        let result = process_manager::run_with_stderr_stream(
            &ffmpeg_bin.to_string_lossy(),
            &str_args,
            on_line,
            Some(phase_cancel),
        )
        .await;

        match result {
            Err(AppError::Cancelled) => {
                cleanup_dir(&tmp);
                emit_job_error(&app, &job_id, "キャンセルされました", "");
                return Err(AppError::Cancelled);
            }
            Err(e) => {
                cleanup_dir(&tmp);
                let msg = e.to_string();
                emit_job_error(&app, &job_id, &msg, "");
                return Err(e);
            }
            Ok(out) if !out.success() => {
                cleanup_dir(&tmp);
                let msg = format!("FFmpeg再エンコードに失敗 (exit {:?})", out.exit_code);
                emit_job_error(&app, &job_id, &msg, &out.stderr);
                return Err(AppError::FFmpeg { message: msg, stderr: out.stderr });
            }
            Ok(_) => {}
        }
    }

    (emit_overall.lock().await)(100.0);

    // クリーンアップ
    cleanup_dir(&tmp);

    // 完了イベント
    let file_size = std::fs::metadata(&params.output_path).map(|m| m.len()).unwrap_or(0);
    let _ = app.emit(
        &format!("job:complete:{}", job_id),
        serde_json::json!({
            "outputPath": params.output_path,
            "durationMs": 0,
            "fileSize": file_size,
        }),
    );

    Ok(params.output_path)
}

// ── イベント発火ヘルパ ────────────────────────────────────────────────────────

fn emit_job_error(app: &AppHandle, job_id: &str, message: &str, stderr: &str) {
    let _ = app.emit(
        &format!("job:error:{job_id}"),
        serde_json::json!({ "message": message, "stderr": stderr }),
    );
}

// ── テスト ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_realesrgan_progress_line() {
        assert_eq!(parse_realesrgan_progress("12.50%"), Some(12.5));
        assert_eq!(parse_realesrgan_progress("  99.99% "), Some(99.99));
        assert_eq!(parse_realesrgan_progress("0.00%"), Some(0.0));
    }

    #[test]
    fn rejects_non_progress_lines() {
        assert_eq!(parse_realesrgan_progress("done"), None);
        assert_eq!(parse_realesrgan_progress(""), None);
        assert_eq!(parse_realesrgan_progress("xx.yy%"), None);
    }
}
