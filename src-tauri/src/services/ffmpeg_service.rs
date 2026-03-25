use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;

use serde::Deserialize;
use std::collections::HashMap;
use tauri::Emitter;
use tokio::sync::oneshot;

use crate::config;
use crate::error::{AppError, AppResult};
use crate::models::ffmpeg::{JobProgress, StreamExtraction};
use crate::models::media::{FormatInfo, MediaInfo, StreamInfo, StreamType, WaveformData};
use crate::platform;

// ── ffprobe JSON デシリアライズ用 Raw 構造体 ──────────────────────────────────

#[derive(Deserialize, Debug, Default)]
struct FfprobeOutput {
    #[serde(default)]
    streams: Vec<FfprobeStream>,
    #[serde(default)]
    format: FfprobeFormat,
}

#[derive(Deserialize, Debug, Default)]
struct FfprobeStream {
    #[serde(default)]
    index: u32,
    codec_name: Option<String>,
    codec_long_name: Option<String>,
    codec_type: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    r_frame_rate: Option<String>,
    pix_fmt: Option<String>,
    sample_rate: Option<String>,
    channels: Option<u32>,
    channel_layout: Option<String>,
    bit_rate: Option<String>,
    duration: Option<String>,
    #[serde(default)]
    tags: HashMap<String, String>,
}

#[derive(Deserialize, Debug, Default)]
struct FfprobeFormat {
    format_name: Option<String>,
    format_long_name: Option<String>,
    duration: Option<String>,
    size: Option<String>,
    bit_rate: Option<String>,
    #[serde(default)]
    tags: HashMap<String, String>,
}

// ── バイナリパス解決 ──────────────────────────────────────────────────────────

fn ffmpeg_bin() -> AppResult<String> {
    let path = platform::ffmpeg_path();
    if path.exists() {
        Ok(path.to_string_lossy().to_string())
    } else {
        Err(AppError::BinaryNotFound { tool: "ffmpeg".to_string() })
    }
}

fn ffprobe_bin() -> AppResult<String> {
    let path = platform::ffprobe_path();
    if path.exists() {
        Ok(path.to_string_lossy().to_string())
    } else {
        Err(AppError::BinaryNotFound { tool: "ffprobe".to_string() })
    }
}

// ── FPS パース ────────────────────────────────────────────────────────────────

fn parse_fps(s: &str) -> Option<f64> {
    let parts: Vec<&str> = s.split('/').collect();
    if parts.len() == 2 {
        let num: f64 = parts[0].trim().parse().ok()?;
        let den: f64 = parts[1].trim().parse().ok()?;
        if den != 0.0 && num / den > 0.0 && num / den < 1000.0 {
            Some(num / den)
        } else {
            None
        }
    } else {
        s.parse().ok()
    }
}

fn convert_stream(raw: FfprobeStream) -> StreamInfo {
    let stream_type = match raw.codec_type.as_deref().unwrap_or("") {
        "video" => StreamType::Video,
        "audio" => StreamType::Audio,
        "subtitle" => StreamType::Subtitle,
        _ => StreamType::Data,
    };

    let fps = raw.r_frame_rate.as_deref().and_then(parse_fps);

    StreamInfo {
        index: raw.index,
        stream_type,
        codec_name: raw.codec_name.unwrap_or_default(),
        codec_long_name: raw.codec_long_name.unwrap_or_default(),
        width: raw.width,
        height: raw.height,
        fps,
        pix_fmt: raw.pix_fmt,
        sample_rate: raw.sample_rate.as_deref().and_then(|s| s.parse().ok()),
        channels: raw.channels,
        channel_layout: raw.channel_layout,
        bit_rate: raw.bit_rate.as_deref().and_then(|s| s.parse().ok()),
        duration: raw.duration.as_deref().and_then(|s| s.parse().ok()),
        language: raw.tags.get("language").cloned(),
        title: raw.tags.get("title").cloned(),
    }
}

// ── probe_media ───────────────────────────────────────────────────────────────

/// ffprobe でメディアファイルの詳細情報を取得する
pub async fn probe_media(path: &str) -> AppResult<MediaInfo> {
    let bin = ffprobe_bin()?;

    let output = crate::services::process_manager::run_command(
        &bin,
        &[
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            path,
        ],
    )
    .await?;

    if !output.success() {
        return Err(AppError::FFmpeg {
            message: format!("ffprobe failed on: {path}"),
            stderr: output.stderr,
        });
    }

    let probe: FfprobeOutput = serde_json::from_str(&output.stdout).map_err(AppError::Serde)?;

    let filename = Path::new(path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let duration: f64 = probe.format.duration.as_deref()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);

    let size: u64 = probe.format.size.as_deref()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    let bit_rate: u64 = probe.format.bit_rate.as_deref()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    let format = FormatInfo {
        name: probe.format.format_name
            .as_deref()
            .unwrap_or("")
            .split(',')
            .next()
            .unwrap_or("")
            .to_string(),
        long_name: probe.format.format_long_name.unwrap_or_default(),
        format_tags: probe.format.tags,
    };

    let streams = probe.streams.into_iter().map(convert_stream).collect();

    Ok(MediaInfo { path: path.to_string(), filename, format, streams, duration, size, bit_rate })
}

// ── generate_thumbnails ───────────────────────────────────────────────────────

/// タイムライン用サムネイルを生成する
/// 動画の尺を均等分割して `count` 枚の JPEG を temp ディレクトリに出力する
pub async fn generate_thumbnails(
    path: &str,
    count: u32,
    width: u32,
    height: u32,
) -> AppResult<Vec<String>> {
    let bin = ffmpeg_bin()?;

    // duration を先に取得
    let probe = probe_media(path).await?;
    let duration = probe.duration;
    if duration <= 0.0 {
        return Ok(vec![]);
    }

    let tmp = config::temp_dir();
    std::fs::create_dir_all(&tmp)?;

    // パスのハッシュでファイル名プレフィックスを作る
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    let prefix = format!("{:x}", hasher.finish());

    let out_pattern = tmp.join(format!("{prefix}_%04d.jpg"));

    let interval = duration / count as f64;
    let vf = format!(
        "fps=1/{interval:.3},scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black"
    );

    let _ = crate::services::process_manager::run_command(
        &bin,
        &[
            "-i", path,
            "-vf", &vf,
            "-frames:v", &count.to_string(),
            "-q:v", "4",
            "-y",
            out_pattern.to_str().unwrap_or(""),
        ],
    )
    .await?;

    let mut paths = Vec::new();
    for i in 1..=count as usize {
        let p = tmp.join(format!("{prefix}_{i:04}.jpg"));
        if p.exists() {
            paths.push(p.to_string_lossy().to_string());
        }
    }

    Ok(paths)
}

// ── generate_waveform ─────────────────────────────────────────────────────────

/// 音声波形データを生成する
/// ffmpeg で 8kHz mono 16-bit PCM に変換し、ダウンサンプルして返す
pub async fn generate_waveform(path: &str, samples: u32) -> AppResult<WaveformData> {
    let bin = ffmpeg_bin()?;

    let probe = probe_media(path).await?;
    let duration = probe.duration;
    let sample_rate = 8000u32;

    // 一時ファイルに PCM を書き出す (stdout は文字列として扱えないため)
    let tmp = config::temp_dir();
    std::fs::create_dir_all(&tmp)?;

    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    let pcm_path = tmp.join(format!("{:x}_waveform.raw", hasher.finish()));

    let output = crate::services::process_manager::run_command(
        &bin,
        &[
            "-i", path,
            "-ac", "1",
            "-ar", &sample_rate.to_string(),
            "-f", "s16le",
            "-acodec", "pcm_s16le",
            "-y",
            pcm_path.to_str().unwrap_or(""),
        ],
    )
    .await;

    // ファイルから読み込む
    let raw = if pcm_path.exists() {
        std::fs::read(&pcm_path).unwrap_or_default()
    } else {
        // フォールバック: 全ゼロ
        let _ = output;
        vec![0u8; (samples * 2) as usize]
    };

    // 後片付け
    let _ = std::fs::remove_file(&pcm_path);

    // i16 サンプルに変換
    let pcm: Vec<i16> = raw
        .chunks_exact(2)
        .map(|b| i16::from_le_bytes([b[0], b[1]]))
        .collect();

    let block_size = if pcm.is_empty() { 1 } else { (pcm.len() / samples as usize).max(1) };
    let result: Vec<f32> = (0..samples as usize)
        .map(|i| {
            let start = i * block_size;
            let end = (start + block_size).min(pcm.len());
            if start >= pcm.len() {
                return 0.0;
            }
            let max = pcm[start..end].iter().map(|s: &i16| s.unsigned_abs()).max().unwrap_or(0);
            max as f32 / i16::MAX as f32
        })
        .collect();

    Ok(WaveformData { samples: result, duration, sample_rate, channels: 1 })
}

// ── FFmpeg 進捗パーサー ────────────────────────────────────────────────────────

/// FFmpeg stderr 出力の進捗行をパースする
/// 例: "frame=  100 fps= 25.0 q=20.0 Lsize=    1024kB time=00:00:04.00 bitrate=2097.2kbits/s speed=1.00x"
pub fn parse_ffmpeg_progress(line: &str, total_duration: f64) -> Option<JobProgress> {
    if !line.contains("time=") || !line.contains("frame=") {
        return None;
    }

    let get_field = |key: &str| -> Option<&str> {
        let search = format!("{key}=");
        let pos = line.find(&search)?;
        let after = line[pos + search.len()..].trim_start();
        let end = after
            .find(|c: char| c == ' ' || c == '\n' || c == '\r')
            .unwrap_or(after.len());
        Some(after[..end].trim())
    };

    let time_str = get_field("time")?;
    let current_time = parse_time_str(time_str)?;
    if current_time < 0.0 {
        return None;
    }

    let percent = if total_duration > 0.0 {
        (current_time / total_duration * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };

    let frame: u64 = get_field("frame").and_then(|s| s.parse().ok()).unwrap_or(0);
    let fps: f64 = get_field("fps").and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let bitrate = get_field("bitrate").unwrap_or("0kbits/s").to_string();
    let speed = get_field("speed").unwrap_or("").to_string();

    let total_size: u64 = get_field("size")
        .or_else(|| get_field("Lsize"))
        .map(|s| s.trim_end_matches(|c: char| c.is_alphabetic()))
        .and_then(|s| s.trim().parse::<u64>().ok())
        .unwrap_or(0)
        * 1024;

    let eta = if total_duration > 0.0 && current_time > 0.0 && percent < 99.9 {
        let speed_mult: f64 = speed.trim_end_matches('x').parse().unwrap_or(1.0);
        if speed_mult > 0.01 {
            let remaining = (total_duration - current_time) / speed_mult;
            let s = remaining as u64;
            Some(format!("{:02}:{:02}", s / 60, s % 60))
        } else {
            None
        }
    } else {
        None
    };

    Some(JobProgress {
        percent,
        frame,
        fps,
        bitrate,
        total_size,
        current_time,
        speed,
        eta,
    })
}

fn parse_time_str(s: &str) -> Option<f64> {
    let parts: Vec<&str> = s.splitn(3, ':').collect();
    if parts.len() == 3 {
        let h: f64 = parts[0].parse().ok()?;
        let m: f64 = parts[1].parse().ok()?;
        let sec: f64 = parts[2].parse().ok()?;
        Some(h * 3600.0 + m * 60.0 + sec)
    } else {
        s.parse().ok()
    }
}

fn format_time(seconds: f64) -> String {
    let total_s = seconds.max(0.0);
    let h = (total_s / 3600.0) as u64;
    let m = ((total_s % 3600.0) / 60.0) as u64;
    let s = total_s % 60.0;
    format!("{h:02}:{m:02}:{s:06.3}")
}

// ── 共通: FFmpeg with progress ────────────────────────────────────────────────

/// FFmpeg を実行して進捗を job:progress:{job_id} イベントで通知する
pub async fn run_ffmpeg_job_pub(
    app: tauri::AppHandle,
    job_id: String,
    args: Vec<String>,
    total_duration: f64,
    output_path: String,
    cancel_rx: oneshot::Receiver<()>,
) -> AppResult<String> {
    let bin = ffmpeg_bin()?;

    let app_clone = app.clone();
    let jid = job_id.clone();

    let on_line = move |line: String| {
        if let Some(progress) = parse_ffmpeg_progress(&line, total_duration) {
            let _ = app_clone.emit(&format!("job:progress:{jid}"), progress);
        }
    };

    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let result = crate::services::process_manager::run_with_stderr_stream(
        &bin,
        &str_args,
        on_line,
        Some(cancel_rx),
    )
    .await;

    match result {
        Err(AppError::Cancelled) => {
            let _ = app.emit(
                &format!("job:error:{}", job_id),
                serde_json::json!({ "message": "キャンセルされました", "stderr": "" }),
            );
            Err(AppError::Cancelled)
        }
        Err(e) => {
            let msg = e.to_string();
            let _ = app.emit(
                &format!("job:error:{}", job_id),
                serde_json::json!({ "message": msg, "stderr": "" }),
            );
            Err(e)
        }
        Ok(output) if !output.success() => {
            let msg = format!("FFmpeg failed (exit {:?})", output.exit_code);
            let _ = app.emit(
                &format!("job:error:{}", job_id),
                serde_json::json!({ "message": msg, "stderr": output.stderr }),
            );
            Err(AppError::FFmpeg { message: msg, stderr: output.stderr })
        }
        Ok(_) => {
            let file_size = std::fs::metadata(&output_path).map(|m| m.len()).unwrap_or(0);
            let _ = app.emit(
                &format!("job:complete:{}", job_id),
                serde_json::json!({ "outputPath": output_path, "durationMs": 0, "fileSize": file_size }),
            );
            Ok(output_path)
        }
    }
}

// ── trim_media ────────────────────────────────────────────────────────────────

/// メディアのトリミング
/// accurate=false: ストリームコピー (高速、キーフレーム単位)
/// accurate=true:  再エンコード (低速、フレーム単位精度)
pub async fn trim_media(
    app: tauri::AppHandle,
    job_id: String,
    input_path: String,
    output_path: String,
    start: f64,
    end: f64,
    accurate: bool,
    cancel_rx: oneshot::Receiver<()>,
) -> AppResult<String> {
    let duration = (end - start).max(0.001);

    let mut args: Vec<String> = vec!["-y".to_string()];

    if accurate {
        // 再エンコード: フレーム精度
        args.extend([
            "-i".to_string(), input_path.clone(),
            "-ss".to_string(), format_time(start),
            "-t".to_string(), format_time(duration),
            "-progress".to_string(), "pipe:2".to_string(),
        ]);
    } else {
        // ストリームコピー: キーフレーム単位
        args.extend([
            "-ss".to_string(), format_time(start),
            "-to".to_string(), format_time(end),
            "-i".to_string(), input_path.clone(),
            "-c".to_string(), "copy".to_string(),
            "-avoid_negative_ts".to_string(), "1".to_string(),
        ]);
    }

    args.push(output_path.clone());

    run_ffmpeg_job_pub(app, job_id, args, duration, output_path, cancel_rx).await
}

// ── extract_streams ───────────────────────────────────────────────────────────

/// ストリームを抽出する (各ストリーム毎に別ファイルへ出力)
pub async fn extract_streams(
    app: tauri::AppHandle,
    job_id: String,
    input_path: String,
    extractions: Vec<StreamExtraction>,
    output_dir: String,
    cancel_rx: oneshot::Receiver<()>,
) -> AppResult<String> {
    let probe = probe_media(&input_path).await?;
    let total_duration = probe.duration;
    let stem = Path::new(&input_path)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // 複数出力の ffmpeg コマンドを一発で実行
    let mut args: Vec<String> = vec![
        "-y".to_string(),
        "-i".to_string(), input_path.clone(),
    ];

    let mut output_paths: Vec<String> = Vec::new();

    for extraction in &extractions {
        let filename = extraction.output_filename.as_deref()
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                format!("{stem}_stream{}.{}", extraction.stream_index, extraction.output_format)
            });
        let out_path = format!("{output_dir}/{filename}");
        output_paths.push(out_path.clone());

        // ストリーム選択
        args.extend(["-map".to_string(), format!("0:{}", extraction.stream_index)]);

        // コーデック設定
        match extraction.output_format.as_str() {
            "mp3"  => args.extend(["-c:a".to_string(), "libmp3lame".to_string()]),
            "aac"  => args.extend(["-c:a".to_string(), "aac".to_string()]),
            "flac" => args.extend(["-c:a".to_string(), "flac".to_string()]),
            "wav"  => args.extend(["-c:a".to_string(), "pcm_s16le".to_string()]),
            "opus" => args.extend(["-c:a".to_string(), "libopus".to_string()]),
            "mp4" | "mkv" | "webm" => args.extend(["-c".to_string(), "copy".to_string()]),
            "srt" | "ass" | "vtt"  => {} // コーデック指定不要
            _      => args.extend(["-c".to_string(), "copy".to_string()]),
        }

        // 追加オプション
        for (k, v) in &extraction.options {
            args.push(format!("-{k}"));
            args.push(v.clone());
        }

        args.push(out_path);
    }

    let first_output = output_paths.first().cloned().unwrap_or(output_dir.clone());
    run_ffmpeg_job_pub(app, job_id, args, total_duration, first_output, cancel_rx).await
}

// ── build_command ─────────────────────────────────────────────────────────────

/// FFmpegCommandからコマンド引数配列を生成する
pub fn build_command(cmd: &crate::models::ffmpeg::FFmpegCommand) -> Vec<String> {
    let mut args = vec!["-y".to_string()];

    // Fast-seek trim (before input)
    if let Some(ref trim) = cmd.trim {
        if !trim.accurate {
            args.push("-ss".to_string());
            args.push(format_time(trim.start));
        }
    }

    // Input
    args.push("-i".to_string());
    args.push(cmd.input_path.clone());

    // Accurate trim (after input)
    if let Some(ref trim) = cmd.trim {
        if trim.accurate {
            args.push("-ss".to_string());
            args.push(format_time(trim.start));
            let dur = (trim.end - trim.start).max(0.001);
            args.push("-t".to_string());
            args.push(format_time(dur));
        }
    }

    // ── Video ────────────────────────────────────────────────────────────
    if cmd.no_video {
        args.push("-vn".to_string());
    } else if cmd.copy_video {
        args.push("-c:v".to_string());
        args.push("copy".to_string());
    } else if let Some(ref codec) = cmd.video_codec {
        args.push("-c:v".to_string());
        args.push(codec.clone());

        if let Some(crf) = cmd.crf {
            args.push("-crf".to_string());
            args.push(crf.to_string());
        }
        if let Some(ref vb) = cmd.video_bitrate {
            args.push("-b:v".to_string());
            args.push(vb.clone());
        }
        if let Some(ref preset) = cmd.preset {
            args.push("-preset".to_string());
            args.push(preset.clone());
        }
    }

    // Video filters (scale + enabled video filters)
    let mut vf_parts: Vec<String> = Vec::new();
    if let Some(ref res) = cmd.resolution {
        vf_parts.push(format!("scale={}:{}", res.width, res.height));
    }
    for f in cmd.filters.iter().filter(|f| {
        f.enabled && f.category.as_deref() == Some("video")
    }) {
        let params_str = f.params.iter()
            .map(|(k, v)| format!("{k}={v}"))
            .collect::<Vec<_>>()
            .join(":");
        if params_str.is_empty() {
            vf_parts.push(f.name.clone());
        } else {
            vf_parts.push(format!("{}={}", f.name, params_str));
        }
    }
    if !vf_parts.is_empty() {
        args.push("-vf".to_string());
        args.push(vf_parts.join(","));
    }

    // FPS
    if let Some(fps) = cmd.fps {
        args.push("-r".to_string());
        args.push(fps.to_string());
    }

    // ── Audio ────────────────────────────────────────────────────────────
    if cmd.no_audio {
        args.push("-an".to_string());
    } else if cmd.copy_audio {
        args.push("-c:a".to_string());
        args.push("copy".to_string());
    } else if let Some(ref codec) = cmd.audio_codec {
        args.push("-c:a".to_string());
        args.push(codec.clone());

        if let Some(ref ab) = cmd.audio_bitrate {
            args.push("-b:a".to_string());
            args.push(ab.clone());
        }
    }

    // Audio filters
    let af_parts: Vec<String> = cmd.filters.iter()
        .filter(|f| f.enabled && f.category.as_deref() == Some("audio"))
        .map(|f| {
            let params_str = f.params.iter()
                .map(|(k, v)| format!("{k}={v}"))
                .collect::<Vec<_>>()
                .join(":");
            if params_str.is_empty() {
                f.name.clone()
            } else {
                format!("{}={}", f.name, params_str)
            }
        })
        .collect();
    if !af_parts.is_empty() {
        args.push("-af".to_string());
        args.push(af_parts.join(","));
    }

    // Extra args
    args.extend(cmd.extra_args.clone());

    // Output
    args.push(cmd.output_path.clone());

    args
}

// ── detect_hw_encoders ───────────────────────────────────────────────────────

/// FFmpegの`-encoders`出力からHWエンコーダーを検出する
pub async fn detect_hw_encoders() -> AppResult<Vec<crate::models::ffmpeg::HWEncoder>> {
    let bin = ffmpeg_bin()?;

    let output = crate::services::process_manager::run_command(
        &bin,
        &["-encoders", "-v", "quiet"],
    )
    .await?;

    let mut encoders = Vec::new();

    for line in output.stdout.lines() {
        let line = line.trim();
        if line.len() < 10 { continue; }
        // Format: " V..... h264_nvenc           NVIDIA NVENC H.264 encoder"
        let (_, rest) = line.split_at(7.min(line.len()));
        let mut parts = rest.split_whitespace();
        let name = match parts.next() { Some(s) => s.to_string(), None => continue };
        let description = parts.collect::<Vec<_>>().join(" ");

        let is_hw = name.contains("nvenc")
            || name.contains("qsv")
            || name.contains("videotoolbox")
            || name.contains("amf")
            || name.contains("vaapi");

        if !is_hw { continue; }

        let codec = if name.starts_with("h264") { "h264".to_string() }
            else if name.starts_with("hevc") { "hevc".to_string() }
            else if name.starts_with("av1")  { "av1".to_string() }
            else if name.starts_with("vp9")  { "vp9".to_string() }
            else { name.split('_').next().unwrap_or("").to_string() };

        let device = if name.contains("nvenc") { "NVIDIA NVENC".to_string() }
            else if name.contains("qsv")         { "Intel Quick Sync".to_string() }
            else if name.contains("videotoolbox") { "Apple VideoToolbox".to_string() }
            else if name.contains("amf")          { "AMD AMF".to_string() }
            else if name.contains("vaapi")        { "VA-API".to_string() }
            else { description.clone() };

        encoders.push(crate::models::ffmpeg::HWEncoder {
            name,
            codec,
            device,
            available: true,
        });
    }

    Ok(encoders)
}

// ── estimate_output_size ─────────────────────────────────────────────────────

/// 出力ファイルサイズを推定する（バイト）
pub fn estimate_output_size(
    duration: f64,
    video_bitrate: Option<u64>,
    audio_bitrate: Option<u64>,
    crf: Option<u32>,
    codec: Option<&str>,
) -> u64 {
    let effective_video_bps = video_bitrate.unwrap_or_else(|| {
        if let Some(crf_val) = crf {
            let base = match codec.unwrap_or("libx264") {
                c if c.contains("265") || c.contains("hevc") => 1000u64,
                c if c.contains("vp9") || c.contains("vpx")  => 900u64,
                c if c.contains("av1") || c.contains("aom")  => 600u64,
                _ => 2000u64,
            };
            let multiplier = 2.0f64.powf((23.0 - crf_val as f64) / 6.0);
            (base as f64 * multiplier) as u64 * 1000
        } else {
            0
        }
    });

    let effective_audio_bps = audio_bitrate.unwrap_or(192_000);
    let total_bps = effective_video_bps + effective_audio_bps;
    if total_bps == 0 || duration <= 0.0 {
        return 0;
    }

    (total_bps as f64 * duration / 8.0) as u64
}
