use tauri::{AppHandle, State};

use crate::models::ytdlp::VideoInfo;
use crate::services::{
    job_queue::{JobQueue, JobType},
    ytdlp_service,
};

#[tauri::command]
pub async fn fetch_video_info(url: String) -> Result<VideoInfo, String> {
    ytdlp_service::get_video_info(&url)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    queue: State<'_, JobQueue>,
    url: String,
    format_id: String,
    output_dir: String,
    filename: Option<String>,
    merge_format: Option<String>,
) -> Result<String, String> {
    let job_id = uuid::Uuid::new_v4().to_string();
    let output_path = filename.as_deref().unwrap_or(&output_dir).to_string();

    let cancel_rx = queue
        .add_job(&job_id, JobType::Download, &url, &output_path)
        .await;

    // emit job added
    queue.emit_queue_updated(&app).await;

    let queue_clone = queue.inner().clone();
    let app_clone = app.clone();
    let job_id_clone = job_id.clone();

    tokio::spawn(async move {
        match ytdlp_service::start_download(
            app_clone.clone(),
            job_id_clone.clone(),
            url,
            format_id,
            output_dir,
            filename,
            merge_format,
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
pub async fn cancel_download(
    app: AppHandle,
    queue: State<'_, JobQueue>,
    job_id: String,
) -> Result<(), String> {
    queue.cancel(&job_id).await;
    queue.emit_queue_updated(&app).await;
    Ok(())
}

#[tauri::command]
pub async fn get_preview_url(url: String) -> Result<String, String> {
    ytdlp_service::get_stream_url(&url)
        .await
        .map_err(|e| e.to_string())
}
