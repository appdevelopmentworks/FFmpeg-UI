use tokio::io::BufReader;

use crate::error::{AppError, AppResult};
use crate::models::ytdlp::{DownloadFormat, DownloadProgress, Thumbnail, VideoInfo};
use crate::platform;

// ── yt-dlp JSON の生デシリアライズ用構造体 ────────────────────────────────────
// yt-dlp は snake_case の JSON を出力し、フィールド名がモデルと異なる場合がある
// (例: vbr/abr → video_bitrate/audio_bitrate)。
// この Raw 構造体でパースし、後で API 型に変換する。

#[derive(serde::Deserialize, Debug, Default)]
struct RawThumbnail {
    url: String,
    #[serde(default)]
    width: u32,
    #[serde(default)]
    height: u32,
}

#[derive(serde::Deserialize, Debug, Default)]
struct RawFormat {
    #[serde(default)]
    format_id: String,
    #[serde(default)]
    format_note: Option<String>,
    #[serde(default)]
    ext: String,
    resolution: Option<String>,
    fps: Option<f64>,
    vcodec: Option<String>,
    acodec: Option<String>,
    /// 映像ビットレート (kbps) - yt-dlp では "vbr"
    vbr: Option<f64>,
    /// 音声ビットレート (kbps) - yt-dlp では "abr"
    abr: Option<f64>,
    filesize: Option<u64>,
    filesize_approx: Option<u64>,
    /// 映像の高さ (ソート・フィルタ用)
    #[allow(dead_code)]
    height: Option<u32>,
}

#[derive(serde::Deserialize, Debug, Default)]
struct RawVideoInfo {
    #[serde(default)]
    id: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    channel: Option<String>,
    #[serde(default)]
    channel_url: Option<String>,
    #[serde(default)]
    uploader: Option<String>,
    duration: Option<f64>,
    #[serde(default)]
    upload_date: Option<String>,
    #[serde(default)]
    view_count: Option<u64>,
    #[serde(default)]
    thumbnail: Option<String>,
    #[serde(default)]
    thumbnails: Vec<RawThumbnail>,
    #[serde(default)]
    formats: Vec<RawFormat>,
    /// プレイリスト判定用
    #[serde(default)]
    _type: Option<String>,
}

// ── 変換関数 ──────────────────────────────────────────────────────────────────

fn convert_format(raw: RawFormat) -> DownloadFormat {
    let vcodec = raw.vcodec.as_deref().unwrap_or("none");
    let acodec = raw.acodec.as_deref().unwrap_or("none");

    let has_video = vcodec != "none" && !vcodec.is_empty();
    let has_audio = acodec != "none" && !acodec.is_empty();

    // "1920x1080" → height = 1080 (フォーマット注記として使用)
    let format_note = raw.format_note.unwrap_or_else(|| {
        raw.resolution
            .clone()
            .unwrap_or_else(|| if has_audio && !has_video { "audio".to_string() } else { "".to_string() })
    });

    DownloadFormat {
        format_id: raw.format_id,
        format_note,
        ext: raw.ext,
        resolution: raw.resolution,
        fps: raw.fps,
        vcodec: if has_video { raw.vcodec } else { None },
        acodec: if has_audio { raw.acodec } else { None },
        video_bitrate: raw.vbr,
        audio_bitrate: raw.abr,
        filesize: raw.filesize,
        filesize_approx: raw.filesize_approx,
        has_video,
        has_audio,
    }
}

fn convert_video_info(raw: RawVideoInfo) -> VideoInfo {
    let channel = raw
        .channel
        .or(raw.uploader)
        .unwrap_or_default();
    let channel_url = raw.channel_url.unwrap_or_default();
    let thumbnail = raw.thumbnail.unwrap_or_default();

    // formats を有用なものだけに絞り込み
    // (storyboard、thumbnail 等の非メディアフォーマットを除外)
    let formats: Vec<DownloadFormat> = raw
        .formats
        .into_iter()
        .filter(|f| {
            !f.ext.is_empty()
                && f.ext != "mhtml"
                && f.ext != "none"
                && f.format_id != "sb0"
                && f.format_id != "sb1"
        })
        .map(convert_format)
        .collect();

    VideoInfo {
        id: raw.id,
        title: raw.title,
        description: raw.description,
        channel,
        channel_url,
        duration: raw.duration.unwrap_or(0.0),
        upload_date: raw.upload_date.unwrap_or_default(),
        view_count: raw.view_count.unwrap_or(0),
        thumbnail,
        thumbnails: raw
            .thumbnails
            .into_iter()
            .map(|t| Thumbnail { url: t.url, width: t.width, height: t.height })
            .collect(),
        formats,
        requested_subtitles: None,
    }
}

// ── ytdlp バイナリパス解決 ───────────────────────────────────────────────────

fn ytdlp_bin() -> AppResult<String> {
    let path = platform::ytdlp_path();
    if path.exists() {
        Ok(path.to_string_lossy().to_string())
    } else {
        Err(AppError::BinaryNotFound { tool: "yt-dlp".to_string() })
    }
}

// ── メタデータ取得 ────────────────────────────────────────────────────────────

/// YouTube URL から動画メタデータを取得する
/// `yt-dlp --dump-json --no-playlist <url>`
pub async fn get_video_info(url: &str) -> AppResult<VideoInfo> {
    let bin = ytdlp_bin()?;

    let output = crate::services::process_manager::run_command(
        &bin,
        &["--dump-json", "--no-playlist", "--no-warnings", url],
    )
    .await?;

    if !output.success() {
        let stderr = output.stderr.clone();
        let msg = classify_ytdlp_error(&stderr);
        return Err(AppError::YtDlp { message: msg, stderr });
    }

    // JSON パース (stdout)
    let raw: RawVideoInfo = serde_json::from_str(&output.stdout).map_err(|e| {
        AppError::YtDlp {
            message: format!("JSON parse failed: {e}"),
            stderr: output.stderr.clone(),
        }
    })?;

    // プレイリスト URL を弾く
    if raw._type.as_deref() == Some("playlist") {
        return Err(AppError::InvalidInput {
            message: "Playlist URLs are not supported. Please provide a single video URL.".to_string(),
        });
    }

    Ok(convert_video_info(raw))
}

// ── ストリームURL取得 ─────────────────────────────────────────────────────────

/// プレビュー用のストリームURLを取得する
/// `yt-dlp -g --no-playlist <url>`
pub async fn get_stream_url(url: &str) -> AppResult<String> {
    let bin = ytdlp_bin()?;

    let output = crate::services::process_manager::run_command(
        &bin,
        &["-g", "--no-playlist", "--no-warnings", url],
    )
    .await?;

    if !output.success() {
        let stderr = output.stderr.clone();
        return Err(AppError::YtDlp { message: classify_ytdlp_error(&stderr), stderr });
    }

    let url = output.stdout.lines().next().unwrap_or("").trim().to_string();
    if url.is_empty() {
        return Err(AppError::YtDlp {
            message: "No stream URL returned".to_string(),
            stderr: output.stderr,
        });
    }

    Ok(url)
}

// ── ダウンロード進捗パーサー ──────────────────────────────────────────────────

/// yt-dlp の出力行をパースして DownloadProgress に変換する
/// パターン例:
///   [download]  45.2% of ~350.00MiB at 12.30MiB/s ETA 00:20
///   [download] 100% of  350.00MiB in 00:00:28
///   [Merger] Merging formats into "output.mp4"
pub fn parse_progress_line(line: &str) -> Option<DownloadProgress> {
    if line.starts_with("[Merger]") || line.starts_with("[ffmpeg]") {
        return Some(DownloadProgress {
            percent: 99.0,
            downloaded_bytes: 0,
            total_bytes: None,
            speed: None,
            eta: None,
            status: "merging".to_string(),
        });
    }

    if line.starts_with("[ExtractAudio]") || line.starts_with("[EmbedThumbnail]") {
        return Some(DownloadProgress {
            percent: 99.5,
            downloaded_bytes: 0,
            total_bytes: None,
            speed: None,
            eta: None,
            status: "post-processing".to_string(),
        });
    }

    if !line.starts_with("[download]") {
        return None;
    }

    let content = &line["[download]".len()..].trim_start().to_owned();

    // パターン: "XX.X% of ~NNN.NNUiB at NNN.NNMiB/s ETA HH:MM"
    // または:   "100% of NNN.NNUiB in HH:MM:SS"
    let percent_end = content.find('%')?;
    let percent_str = content[..percent_end].trim();
    let percent: f64 = percent_str.parse().ok()?;

    // "of ~350.00MiB" を探す
    let of_pos = content.find(" of ")?;
    let after_of = content[of_pos + 4..].trim_start_matches('~').trim();

    // 合計サイズを解析: "350.00MiB" のような形式
    let size_end = after_of
        .find(|c: char| !c.is_ascii_digit() && c != '.' && !c.is_alphabetic())
        .unwrap_or(after_of.len());
    let size_str = &after_of[..size_end];
    let total_bytes = parse_human_size(size_str);

    // "at 12.30MiB/s" または "in HH:MM:SS" の後
    let (speed, eta) = if let Some(at_pos) = content.find(" at ") {
        let after_at = content[at_pos + 4..].trim();
        // speed: 最初のトークン
        let speed_tok = after_at.split_whitespace().next().unwrap_or("").to_string();
        let speed = if speed_tok == "Unknown" { None } else { Some(speed_tok) };
        // ETA
        let eta = if let Some(eta_pos) = after_at.find(" ETA ") {
            let eta_str = after_at[eta_pos + 5..].trim().to_string();
            if eta_str == "Unknown" { None } else { Some(eta_str) }
        } else {
            None
        };
        (speed, eta)
    } else {
        (None, None)
    };

    // downloaded bytes は percent × total から概算
    let downloaded_bytes = if let Some(total) = total_bytes {
        ((percent / 100.0) * total as f64) as u64
    } else {
        0
    };

    Some(DownloadProgress {
        percent,
        downloaded_bytes,
        total_bytes,
        speed,
        eta,
        status: "downloading".to_string(),
    })
}

/// 人間が読める容量文字列をバイト数に変換
/// "350.00MiB" → 367001600
fn parse_human_size(s: &str) -> Option<u64> {
    // 数値部分と単位を分割
    let num_end = s.find(|c: char| c.is_alphabetic())?;
    let num: f64 = s[..num_end].parse().ok()?;
    let unit = &s[num_end..];

    let multiplier: f64 = match unit {
        "B"   => 1.0,
        "KiB" | "KB" | "K" => 1024.0,
        "MiB" | "MB" | "M" => 1024.0 * 1024.0,
        "GiB" | "GB" | "G" => 1024.0 * 1024.0 * 1024.0,
        "TiB" | "TB"        => 1024.0 * 1024.0 * 1024.0 * 1024.0,
        _ => return None,
    };

    Some((num * multiplier) as u64)
}

// ── yt-dlp エラー分類 ─────────────────────────────────────────────────────────

fn classify_ytdlp_error(stderr: &str) -> String {
    if stderr.contains("Video unavailable") {
        return "動画が利用できません（地域制限・削除済みの可能性があります）".to_string();
    }
    if stderr.contains("Sign in to confirm your age") || stderr.contains("age-restricted") {
        return "年齢制限のある動画です".to_string();
    }
    if stderr.contains("Private video") {
        return "プライベート動画です".to_string();
    }
    if stderr.contains("members-only") {
        return "メンバー限定動画です".to_string();
    }
    if stderr.contains("is not a valid URL") || stderr.contains("Unsupported URL") {
        return "無効なURLです".to_string();
    }
    if stderr.contains("Unable to extract") {
        return "動画情報の取得に失敗しました".to_string();
    }

    // 最初のエラー行を返す
    stderr
        .lines()
        .find(|l| l.contains("ERROR:") || !l.trim().is_empty())
        .unwrap_or("yt-dlp error")
        .trim_start_matches("ERROR: ")
        .to_string()
}

// ── ダウンロード実行 ──────────────────────────────────────────────────────────

#[derive(serde::Serialize, Clone)]
pub struct DlCompletePayload {
    pub output_path: String,
    pub file_size: u64,
}

#[derive(serde::Serialize, Clone)]
pub struct DlErrorPayload {
    pub message: String,
}

/// yt-dlp でダウンロードを実行する
/// 進捗は "download:progress:{job_id}" イベントで通知する
pub async fn start_download(
    app: tauri::AppHandle,
    job_id: String,
    url: String,
    format_id: String,
    output_dir: String,
    filename: Option<String>,
    merge_format: Option<String>,
    cancel_rx: tokio::sync::oneshot::Receiver<()>,
) -> AppResult<String> {
    use tauri::Emitter;

    let bin = ytdlp_bin()?;

    // 出力テンプレート
    let output_template = if let Some(name) = filename {
        format!("{}/{}", output_dir, name)
    } else {
        format!("{}/%(title)s.%(ext)s", output_dir)
    };

    // yt-dlp 引数を構築
    let mut args: Vec<String> = vec![
        "--no-playlist".into(),
        "--newline".into(), // 1行ずつ進捗を出力
        "--progress".into(),
        "-f".into(),
        format_id.clone(),
        "-o".into(),
        output_template.clone(),
    ];

    if let Some(fmt) = merge_format {
        args.push("--merge-output-format".into());
        args.push(fmt);
    }

    args.push(url.clone());

    // プロセス起動
    let mut child = tokio::process::Command::new(&bin)
        .args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| AppError::Io(e))?;

    let stderr = child.stderr.take().expect("stderr");
    let stdout = child.stdout.take().expect("stdout");

    let app_clone = app.clone();
    let jid = job_id.clone();

    // stdout/stderr をマージして進捗を読み取る
    // yt-dlp は --newline 付きで stdout に進捗を書き出す
    let progress_task: tokio::task::JoinHandle<(String, String)> = tokio::spawn(async move {
        use tokio::io::AsyncBufReadExt;
        let mut stdout_lines = BufReader::new(stdout).lines();
        let mut stderr_lines = BufReader::new(stderr).lines();
        let mut stderr_buf = String::new();
        let mut last_output_path = String::new();

        loop {
            tokio::select! {
                line = stdout_lines.next_line() => {
                    match line {
                        Ok(Some(l)) => {
                            if let Some(progress) = parse_progress_line(&l) {
                                let _ = app_clone.emit(
                                    &format!("download:progress:{jid}"),
                                    progress,
                                );
                            }
                            // 出力先ファイルパスを記録
                            if l.contains("Destination:") {
                                if let Some(path) = l.split("Destination:").nth(1) {
                                    last_output_path = path.trim().to_string();
                                }
                            }
                            if l.contains("Merging formats into") {
                                if let Some(path) = l.split('"').nth(1) {
                                    last_output_path = path.to_string();
                                }
                            }
                        }
                        Ok(None) => break,
                        Err(_) => break,
                    }
                }
                line = stderr_lines.next_line() => {
                    match line {
                        Ok(Some(l)) => {
                            if !stderr_buf.is_empty() { stderr_buf.push('\n'); }
                            stderr_buf.push_str(&l);
                        }
                        Ok(None) => {}
                        Err(_) => {}
                    }
                }
            }
        }

        // 残りの stderr も収集
        while let Ok(Some(l)) = stderr_lines.next_line().await {
            if !stderr_buf.is_empty() { stderr_buf.push('\n'); }
            stderr_buf.push_str(&l);
        }

        (last_output_path, stderr_buf)
    });

    // キャンセル or 完了を待つ
    let result = tokio::select! {
        _ = cancel_rx => {
            child.kill().await.ok();
            progress_task.abort();
            return Err(AppError::Cancelled);
        }
        status = child.wait() => status,
    };

    let exit_status = result?;
    let (output_path, stderr_buf) = progress_task.await.unwrap_or_default();

    if !exit_status.success() {
        let msg = classify_ytdlp_error(&stderr_buf);
        let _ = app.emit(
            &format!("download:error:{}", job_id),
            DlErrorPayload { message: msg.clone() },
        );
        return Err(AppError::YtDlp { message: msg, stderr: stderr_buf });
    }

    // 出力ファイルのサイズを取得
    let file_size = if !output_path.is_empty() {
        std::fs::metadata(&output_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    let _ = app.emit(
        &format!("download:complete:{}", job_id),
        DlCompletePayload {
            output_path: output_path.clone(),
            file_size,
        },
    );

    Ok(output_path)
}
