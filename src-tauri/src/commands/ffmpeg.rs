use tauri::{AppHandle, State};

use crate::models::ffmpeg::StreamExtraction;
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

    // emit job added
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

    // emit job added
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
