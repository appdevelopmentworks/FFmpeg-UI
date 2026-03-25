use crate::models::ffmpeg::FFmpegCommand;
use crate::models::preset::{Preset, PresetCategory, PresetList};

// ── ビルトインプリセット ──────────────────────────────────────────────────────

fn base_cmd() -> FFmpegCommand {
    FFmpegCommand {
        input_path: String::new(),
        output_path: String::new(),
        video_codec: None,
        audio_codec: None,
        video_bitrate: None,
        audio_bitrate: None,
        resolution: None,
        fps: None,
        crf: None,
        preset: None,
        hw_accel: None,
        filters: Vec::new(),
        trim: None,
        extra_args: Vec::new(),
        two_pass: false,
        container: None,
        copy_video: false,
        copy_audio: false,
        no_video: false,
        no_audio: false,
    }
}

pub fn builtin_presets() -> Vec<Preset> {
    vec![
        Preset {
            id: "web-h264".to_string(),
            name: "Web (H.264/AAC)".to_string(),
            description: "Web配信向け H.264 + AAC、CRF 23".to_string(),
            category: PresetCategory::Web,
            is_builtin: true,
            command: FFmpegCommand {
                video_codec: Some("libx264".to_string()),
                audio_codec: Some("aac".to_string()),
                crf: Some(23),
                preset: Some("fast".to_string()),
                audio_bitrate: Some("192k".to_string()),
                container: Some("mp4".to_string()),
                ..base_cmd()
            },
            created_at: None,
            updated_at: None,
        },
        Preset {
            id: "web-h265".to_string(),
            name: "Web (H.265/AAC)".to_string(),
            description: "高圧縮 H.265 + AAC、CRF 28".to_string(),
            category: PresetCategory::Web,
            is_builtin: true,
            command: FFmpegCommand {
                video_codec: Some("libx265".to_string()),
                audio_codec: Some("aac".to_string()),
                crf: Some(28),
                preset: Some("fast".to_string()),
                audio_bitrate: Some("192k".to_string()),
                container: Some("mp4".to_string()),
                ..base_cmd()
            },
            created_at: None,
            updated_at: None,
        },
        Preset {
            id: "web-vp9".to_string(),
            name: "WebM (VP9/Opus)".to_string(),
            description: "ブラウザ対応 VP9 + Opus".to_string(),
            category: PresetCategory::Web,
            is_builtin: true,
            command: FFmpegCommand {
                video_codec: Some("libvpx-vp9".to_string()),
                audio_codec: Some("libopus".to_string()),
                crf: Some(33),
                audio_bitrate: Some("128k".to_string()),
                container: Some("webm".to_string()),
                ..base_cmd()
            },
            created_at: None,
            updated_at: None,
        },
        Preset {
            id: "social-instagram".to_string(),
            name: "Instagram (1080x1080)".to_string(),
            description: "Instagram正方形動画 1:1".to_string(),
            category: PresetCategory::Social,
            is_builtin: true,
            command: FFmpegCommand {
                video_codec: Some("libx264".to_string()),
                audio_codec: Some("aac".to_string()),
                crf: Some(23),
                preset: Some("fast".to_string()),
                resolution: Some(crate::models::ffmpeg::Resolution {
                    width: 1080,
                    height: 1080,
                }),
                audio_bitrate: Some("192k".to_string()),
                container: Some("mp4".to_string()),
                ..base_cmd()
            },
            created_at: None,
            updated_at: None,
        },
        Preset {
            id: "social-twitter".to_string(),
            name: "Twitter/X (1280x720)".to_string(),
            description: "Twitter/X 動画 720p".to_string(),
            category: PresetCategory::Social,
            is_builtin: true,
            command: FFmpegCommand {
                video_codec: Some("libx264".to_string()),
                audio_codec: Some("aac".to_string()),
                crf: Some(23),
                preset: Some("fast".to_string()),
                resolution: Some(crate::models::ffmpeg::Resolution {
                    width: 1280,
                    height: 720,
                }),
                fps: Some(30.0),
                audio_bitrate: Some("128k".to_string()),
                container: Some("mp4".to_string()),
                ..base_cmd()
            },
            created_at: None,
            updated_at: None,
        },
        Preset {
            id: "archive-copy".to_string(),
            name: "アーカイブ (再エンコードなし)".to_string(),
            description: "コンテナ変換のみ".to_string(),
            category: PresetCategory::Archive,
            is_builtin: true,
            command: FFmpegCommand {
                copy_video: true,
                copy_audio: true,
                container: Some("mkv".to_string()),
                ..base_cmd()
            },
            created_at: None,
            updated_at: None,
        },
        Preset {
            id: "audio-mp3".to_string(),
            name: "音声抽出 (MP3)".to_string(),
            description: "映像なし、MP3 高品質".to_string(),
            category: PresetCategory::Audio,
            is_builtin: true,
            command: FFmpegCommand {
                audio_codec: Some("libmp3lame".to_string()),
                no_video: true,
                extra_args: vec!["-q:a".to_string(), "2".to_string()],
                ..base_cmd()
            },
            created_at: None,
            updated_at: None,
        },
        Preset {
            id: "audio-flac".to_string(),
            name: "音声抽出 (FLAC)".to_string(),
            description: "映像なし、FLACロスレス".to_string(),
            category: PresetCategory::Audio,
            is_builtin: true,
            command: FFmpegCommand {
                audio_codec: Some("flac".to_string()),
                no_video: true,
                ..base_cmd()
            },
            created_at: None,
            updated_at: None,
        },
    ]
}

// ── file I/O helpers ──────────────────────────────────────────────────────────

async fn load_user_presets() -> Vec<Preset> {
    let path = crate::config::presets_file();
    if !path.exists() {
        return Vec::new();
    }
    let content = tokio::fs::read_to_string(&path).await.unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_default()
}

async fn save_user_presets(presets: &[Preset]) -> Result<(), String> {
    let path = crate::config::presets_file();
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(presets).map_err(|e| e.to_string())?;
    tokio::fs::write(&path, json)
        .await
        .map_err(|e| e.to_string())
}

// ── Tauri コマンド ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_presets() -> Result<PresetList, String> {
    let builtin = builtin_presets();
    let user = load_user_presets().await;
    Ok(PresetList { builtin, user })
}

#[tauri::command]
pub async fn save_preset(preset: Preset) -> Result<String, String> {
    if preset.is_builtin {
        return Err("ビルトインプリセットは上書きできません".to_string());
    }

    let mut user_presets = load_user_presets().await;

    if let Some(existing) = user_presets.iter_mut().find(|p| p.id == preset.id) {
        *existing = preset.clone();
    } else {
        user_presets.push(preset.clone());
    }

    save_user_presets(&user_presets).await?;
    Ok(preset.id)
}

#[tauri::command]
pub async fn delete_preset(preset_id: String) -> Result<(), String> {
    let mut user_presets = load_user_presets().await;
    user_presets.retain(|p| p.id != preset_id);
    save_user_presets(&user_presets).await
}
