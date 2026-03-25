use tauri::{AppHandle, State};
use tokio::sync::oneshot;

use crate::config;
use crate::error::AppResult;
use crate::models::ffmpeg::{FFmpegCommand, HWEncoder, StreamExtraction};
use crate::models::media::{MediaInfo, WaveformData};
use crate::services::{
    ffmpeg_service,
    job_queue::{JobQueue, JobType},
};

#[tauri::command]
pub async fn probe_media(path: String) -> Result<MediaInfo, String> {
    ffmpeg_service::probe_media(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_thumbnails(
    path: String,
    count: u32,
    width: u32,
    height: u32,
) -> Result<Vec<String>, String> {
    ffmpeg_service::generate_thumbnails(&path, count, width, height)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_waveform(path: String, samples: u32) -> Result<WaveformData, String> {
    ffmpeg_service::generate_waveform(&path, samples)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trim_media(
    app: AppHandle,
    queue: State<'_, JobQueue>,
    input_path: String,
    output_path: String,
    start: f64,
    end: f64,
    accurate: bool,
    #[allow(unused_variables)] segments: Option<Vec<crate::models::ffmpeg::TrimSegment>>,
) -> Result<String, String> {
    let job_id = uuid::Uuid::new_v4().to_string();

    let cancel_rx = queue
        .add_job(&job_id, JobType::Trim, &input_path, &output_path)
        .await;

    queue.emit_queue_updated(&app).await;

    let queue_clone = queue.inner().clone();
    let app_clone = app.clone();
    let job_id_clone = job_id.clone();

    tokio::spawn(async move {
        match ffmpeg_service::trim_media(
            app_clone.clone(),
            job_id_clone.clone(),
            input_path,
            output_path,
            start,
            end,
            accurate,
            cancel_rx,
        )
        .await
        {
            Ok(out) => queue_clone.complete_job(&job_id_clone, &out).await,
            Err(e) => queue_clone.fail_job(&job_id_clone, &e.to_string()).await,
        }
        queue_clone.emit_queue_updated(&app_clone).await;
    });

    Ok(job_id)
}

#[tauri::command]
pub async fn extract_streams(
    app: AppHandle,
    queue: State<'_, JobQueue>,
    input_path: String,
    extractions: Vec<StreamExtraction>,
    output_dir: String,
) -> Result<String, String> {
    let job_id = uuid::Uuid::new_v4().to_string();

    let cancel_rx = queue
        .add_job(&job_id, JobType::Extract, &input_path, &output_dir)
        .await;

    queue.emit_queue_updated(&app).await;

    let queue_clone = queue.inner().clone();
    let app_clone = app.clone();
    let job_id_clone = job_id.clone();

    tokio::spawn(async move {
        match ffmpeg_service::extract_streams(
            app_clone.clone(),
            job_id_clone.clone(),
            input_path,
            extractions,
            output_dir,
            cancel_rx,
        )
        .await
        {
            Ok(out) => queue_clone.complete_job(&job_id_clone, &out).await,
            Err(e) => queue_clone.fail_job(&job_id_clone, &e.to_string()).await,
        }
        queue_clone.emit_queue_updated(&app_clone).await;
    });

    Ok(job_id)
}

// ── execute_ffmpeg ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn execute_ffmpeg(
    app: AppHandle,
    queue: State<'_, JobQueue>,
    command: FFmpegCommand,
) -> Result<String, String> {
    let job_id = uuid::Uuid::new_v4().to_string();
    let input_path = command.input_path.clone();
    let output_path = command.output_path.clone();
    let two_pass = command.two_pass;

    let cancel_rx = queue
        .add_job(&job_id, JobType::Convert, &input_path, &output_path)
        .await;

    queue.emit_queue_updated(&app).await;

    let queue_clone = queue.inner().clone();
    let app_clone = app.clone();
    let job_id_clone = job_id.clone();

    tokio::spawn(async move {
        let result = if two_pass {
            run_two_pass(app_clone.clone(), job_id_clone.clone(), command, cancel_rx).await
        } else {
            let args = ffmpeg_service::build_command(&command);
            let duration = ffmpeg_service::probe_media(&command.input_path)
                .await
                .map(|m| m.duration)
                .unwrap_or(0.0);
            ffmpeg_service::run_ffmpeg_job_pub(
                app_clone.clone(),
                job_id_clone.clone(),
                args,
                duration,
                command.output_path.clone(),
                cancel_rx,
            )
            .await
        };

        match result {
            Ok(out) => queue_clone.complete_job(&job_id_clone, &out).await,
            Err(e) => queue_clone.fail_job(&job_id_clone, &e.to_string()).await,
        }
        queue_clone.emit_queue_updated(&app_clone).await;
    });

    Ok(job_id)
}

async fn run_two_pass(
    app: AppHandle,
    job_id: String,
    command: FFmpegCommand,
    cancel_rx: oneshot::Receiver<()>,
) -> AppResult<String> {
    let tmp = config::temp_dir();
    std::fs::create_dir_all(&tmp).map_err(crate::error::AppError::Io)?;
    let passlog = tmp.join(format!("{job_id}_passlog"));
    let passlog_str = passlog.to_string_lossy().to_string();

    let duration = ffmpeg_service::probe_media(&command.input_path)
        .await
        .map(|m| m.duration)
        .unwrap_or(0.0);

    // Pass 1 — null output
    let mut args1 = ffmpeg_service::build_command(&command);
    args1.pop(); // remove output path
    args1.extend([
        "-pass".to_string(), "1".to_string(),
        "-passlogfile".to_string(), passlog_str.clone(),
        "-f".to_string(), "null".to_string(),
        if cfg!(windows) { "NUL".to_string() } else { "/dev/null".to_string() },
    ]);

    let (_, dummy_rx) = oneshot::channel::<()>();
    let _ = ffmpeg_service::run_ffmpeg_job_pub(
        app.clone(),
        format!("{job_id}_pass1"),
        args1,
        duration,
        "NUL".to_string(),
        dummy_rx,
    )
    .await;

    // Pass 2 — real output
    let mut args2 = ffmpeg_service::build_command(&command);
    args2.pop(); // remove output path
    args2.extend([
        "-pass".to_string(), "2".to_string(),
        "-passlogfile".to_string(), passlog_str,
    ]);
    args2.push(command.output_path.clone());

    ffmpeg_service::run_ffmpeg_job_pub(
        app,
        job_id,
        args2,
        duration,
        command.output_path.clone(),
        cancel_rx,
    )
    .await
}

// ── execute_raw_command ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn execute_raw_command(
    app: AppHandle,
    queue: State<'_, JobQueue>,
    command_string: String,
) -> Result<String, String> {
    let args = tokenize_shell_command(&command_string).map_err(|e| e.to_string())?;

    if args.is_empty() {
        return Err("空のコマンドです".to_string());
    }
    let program = args[0].to_lowercase();
    let program_base = std::path::Path::new(&program)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();
    if program_base != "ffmpeg" && program_base != "ffprobe" {
        return Err("ffmpeg または ffprobe コマンドのみ実行できます".to_string());
    }

    let input_path = args
        .windows(2)
        .find(|w| w[0] == "-i")
        .map(|w| w[1].clone())
        .unwrap_or_default();
    let output_path = args.last().cloned().unwrap_or_default();

    let job_id = uuid::Uuid::new_v4().to_string();
    let cancel_rx = queue
        .add_job(&job_id, JobType::RawCommand, &input_path, &output_path)
        .await;
    queue.emit_queue_updated(&app).await;

    let queue_clone = queue.inner().clone();
    let app_clone = app.clone();
    let job_id_clone = job_id.clone();
    let args_tail = args[1..].to_vec();

    tokio::spawn(async move {
        let duration = if !input_path.is_empty() {
            ffmpeg_service::probe_media(&input_path)
                .await
                .map(|m| m.duration)
                .unwrap_or(0.0)
        } else {
            0.0
        };

        let result = ffmpeg_service::run_ffmpeg_job_pub(
            app_clone.clone(),
            job_id_clone.clone(),
            args_tail,
            duration,
            output_path,
            cancel_rx,
        )
        .await;

        match result {
            Ok(out) => queue_clone.complete_job(&job_id_clone, &out).await,
            Err(e) => queue_clone.fail_job(&job_id_clone, &e.to_string()).await,
        }
        queue_clone.emit_queue_updated(&app_clone).await;
    });

    Ok(job_id)
}

fn tokenize_shell_command(input: &str) -> Result<Vec<String>, String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_quote: Option<char> = None;

    for c in input.chars() {
        match (c, in_quote) {
            ('"', None) => in_quote = Some('"'),
            ('\'', None) => in_quote = Some('\''),
            ('"', Some('"')) => in_quote = None,
            ('\'', Some('\'')) => in_quote = None,
            (' ', None) | ('\t', None) => {
                if !current.is_empty() {
                    tokens.push(current.clone());
                    current.clear();
                }
            }
            _ => current.push(c),
        }
    }

    if in_quote.is_some() {
        return Err("クォートが閉じられていません".to_string());
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    Ok(tokens)
}

// ── build_command_preview ─────────────────────────────────────────────────────

#[tauri::command]
pub fn build_command_preview(command: FFmpegCommand) -> Result<String, String> {
    let args = ffmpeg_service::build_command(&command);
    let parts: Vec<String> = std::iter::once("ffmpeg".to_string())
        .chain(args.into_iter().map(|a| {
            if a.contains(' ') {
                format!("\"{a}\"")
            } else {
                a
            }
        }))
        .collect();
    Ok(parts.join(" "))
}

// ── detect_hw_encoders ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn detect_hw_encoders() -> Result<Vec<HWEncoder>, String> {
    ffmpeg_service::detect_hw_encoders()
        .await
        .map_err(|e| e.to_string())
}

// ── estimate_output_size ──────────────────────────────────────────────────────

#[tauri::command]
pub fn estimate_output_size(
    duration: f64,
    video_bitrate: Option<u64>,
    audio_bitrate: Option<u64>,
    crf: Option<u32>,
    codec: Option<String>,
) -> Result<u64, String> {
    Ok(ffmpeg_service::estimate_output_size(
        duration,
        video_bitrate,
        audio_bitrate,
        crf,
        codec.as_deref(),
    ))
}
