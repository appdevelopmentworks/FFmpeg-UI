use tauri::{AppHandle, Emitter};

use crate::models::settings::{BinaryStatus, UpdateInfo};
use crate::services::binary_manager::{
    self, check_all_binaries, DownloadCompletePayload, DownloadErrorPayload,
};

// ── check_binaries ────────────────────────────────────────────────────────────

/// バイナリの存在確認とバージョン取得
/// docs/04_api_design.md セクション 2.1
#[tauri::command]
pub async fn check_binaries() -> Result<BinaryStatus, String> {
    Ok(check_all_binaries().await)
}

// ── download_binary ───────────────────────────────────────────────────────────

/// バイナリのダウンロード開始（進捗はイベントで通知）
/// docs/04_api_design.md セクション 2.2
///
/// Events emitted:
///   "setup:download-progress" { tool, percent, downloaded, total }
///   "setup:download-complete" { tool, version, path }
///   "setup:download-error"    { tool, error }
#[tauri::command]
pub async fn download_binary(
    app: AppHandle,
    tool: String,
) -> Result<String, String> {
    let app_clone = app.clone();

    let result = match tool.as_str() {
        "ffmpeg" => binary_manager::install_ffmpeg(&app).await,
        "ytdlp" => binary_manager::install_ytdlp(&app).await,
        other => {
            return Err(format!("Unknown tool: {other}. Use 'ffmpeg' or 'ytdlp'"));
        }
    };

    match result {
        Ok(version) => {
            let path = match tool.as_str() {
                "ffmpeg" => crate::platform::ffmpeg_path()
                    .to_string_lossy()
                    .to_string(),
                _ => crate::platform::ytdlp_path()
                    .to_string_lossy()
                    .to_string(),
            };

            let _ = app_clone.emit(
                "setup:download-complete",
                DownloadCompletePayload {
                    tool: tool.clone(),
                    version: version.clone(),
                    path: path.clone(),
                },
            );

            Ok(path)
        }
        Err(e) => {
            let err_msg = e.to_string();
            let _ = app_clone.emit(
                "setup:download-error",
                DownloadErrorPayload {
                    tool: tool.clone(),
                    error: err_msg.clone(),
                },
            );
            Err(err_msg)
        }
    }
}

// ── check_updates ─────────────────────────────────────────────────────────────

/// バイナリの更新確認
/// docs/04_api_design.md セクション 2.3
#[tauri::command]
pub async fn check_updates() -> Result<UpdateInfo, String> {
    let status = check_all_binaries().await;
    binary_manager::check_for_updates(
        status.ffmpeg_version.as_deref(),
        status.ytdlp_version.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}
