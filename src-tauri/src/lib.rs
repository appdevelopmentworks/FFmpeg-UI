pub mod commands;
pub mod config;
pub mod error;
pub mod models;
pub mod platform;
pub mod services;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(crate::services::job_queue::JobQueue::new())
        .invoke_handler(tauri::generate_handler![
            // Setup
            commands::setup::check_binaries,
            commands::setup::download_binary,
            commands::setup::check_updates,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::reset_settings,
            // YouTube
            commands::ytdlp::fetch_video_info,
            commands::ytdlp::start_download,
            commands::ytdlp::cancel_download,
            commands::ytdlp::get_preview_url,
            // FFmpeg
            commands::ffmpeg::probe_media,
            commands::ffmpeg::generate_thumbnails,
            commands::ffmpeg::generate_waveform,
            commands::ffmpeg::trim_media,
            commands::ffmpeg::extract_streams,
            // Jobs
            commands::jobs::get_jobs,
            commands::jobs::cancel_job,
            commands::jobs::pause_job,
            commands::jobs::resume_job,
            commands::jobs::reorder_jobs,
            commands::jobs::clear_completed_jobs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
