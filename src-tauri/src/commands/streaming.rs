use serde::Serialize;
use tauri::Emitter;

use crate::models::media::{StreamInfo, StreamType};
use crate::platform;
use crate::services::job_queue::JobQueue;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StreamProbeResult {
    pub url: String,
    pub protocol: String,
    pub streams: Vec<StreamInfo>,
    pub is_live: bool,
}

/// ストリームURL をプローブしてメタデータを取得
#[tauri::command]
pub async fn probe_stream(url: String) -> Result<StreamProbeResult, String> {
    let ffprobe = platform::ffprobe_path();
    let output = tokio::process::Command::new(&ffprobe)
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            &url,
        ])
        .output()
        .await
        .map_err(|e| format!("ffprobe 起動エラー: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let val: serde_json::Value =
        serde_json::from_str(&stdout).map_err(|e| format!("JSON パースエラー: {e}"))?;

    let format_name = val["format"]["format_name"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let protocol = if url.starts_with("rtmp") {
        "rtmp"
    } else if url.starts_with("rtsp") {
        "rtsp"
    } else if url.starts_with("http") && (url.contains(".m3u8") || url.contains("hls")) {
        "hls"
    } else if url.starts_with("http") {
        "http"
    } else if url.starts_with("udp") {
        "udp"
    } else {
        "unknown"
    }
    .to_string();

    let is_live = format_name.contains("flv")
        || protocol == "rtmp"
        || protocol == "rtsp"
        || protocol == "hls"
        || val["format"]["tags"]["variant_bitrate"].is_string();

    let streams = val["streams"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|s| {
                    let stream_type = match s["codec_type"].as_str().unwrap_or("") {
                        "audio" => StreamType::Audio,
                        "subtitle" => StreamType::Subtitle,
                        "data" => StreamType::Data,
                        _ => StreamType::Video,
                    };
                    StreamInfo {
                        index: s["index"].as_u64().unwrap_or(0) as u32,
                        stream_type,
                        codec_name: s["codec_name"].as_str().unwrap_or("").to_string(),
                        codec_long_name: s["codec_long_name"].as_str().unwrap_or("").to_string(),
                        width: s["width"].as_u64().map(|v| v as u32),
                        height: s["height"].as_u64().map(|v| v as u32),
                        fps: None,
                        pix_fmt: s["pix_fmt"].as_str().map(|p| p.to_string()),
                        bit_rate: s["bit_rate"].as_str().and_then(|b| b.parse().ok()),
                        duration: s["duration"].as_str().and_then(|d| d.parse().ok()),
                        sample_rate: s["sample_rate"]
                            .as_str()
                            .and_then(|r| r.parse().ok()),
                        channels: s["channels"].as_u64().map(|v| v as u32),
                        language: s["tags"]["language"].as_str().map(|l| l.to_string()),
                        title: s["tags"]["title"].as_str().map(|t| t.to_string()),
                        channel_layout: s["channel_layout"].as_str().map(|c| c.to_string()),
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(StreamProbeResult {
        url,
        protocol,
        streams,
        is_live,
    })
}

/// ストリーム録画を開始
#[tauri::command]
pub async fn start_recording(
    app: tauri::AppHandle,
    url: String,
    output_path: String,
    format: Option<String>,
    duration_limit: Option<u64>,
    _queue: tauri::State<'_, JobQueue>,
) -> Result<String, String> {
    let job_id = uuid::Uuid::new_v4().to_string();
    let ffmpeg = platform::ffmpeg_path();

    let mut args = vec!["-y".to_string()];
    args.push("-i".to_string());
    args.push(url);
    args.push("-c".to_string());
    args.push("copy".to_string());

    if let Some(secs) = duration_limit {
        args.push("-t".to_string());
        args.push(secs.to_string());
    }

    if let Some(fmt) = &format {
        args.push("-f".to_string());
        args.push(fmt.clone());
    }

    args.push(output_path.clone());

    let job_id_clone = job_id.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        let result = tokio::process::Command::new(&ffmpeg).args(&args).output().await;

        let event = match result {
            Ok(out) if out.status.success() => serde_json::json!({
                "jobId": job_id_clone,
                "status": "completed",
                "outputPath": output_path,
            }),
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                serde_json::json!({
                    "jobId": job_id_clone,
                    "status": "error",
                    "error": stderr,
                })
            }
            Err(e) => serde_json::json!({
                "jobId": job_id_clone,
                "status": "error",
                "error": e.to_string(),
            }),
        };
        let _ = app_clone.emit("recording:complete", event);
    });

    Ok(job_id)
}

/// ストリーム録画を停止
#[tauri::command]
pub async fn stop_recording(job_id: String) -> Result<String, String> {
    // TODO: プロセスIDを管理して kill する
    Ok(job_id)
}
