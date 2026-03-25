use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub output_dir: String,
    pub duplicate_action: DuplicateAction,
    pub max_parallel_jobs: u32,
    pub theme: Theme,
    pub locale: Locale,
    pub notifications: bool,
    pub ffmpeg_path: Option<String>,
    pub ytdlp_path: Option<String>,
    pub filename_template: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            output_dir: dirs::download_dir()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            duplicate_action: DuplicateAction::Ask,
            max_parallel_jobs: 2,
            theme: Theme::Dark,
            locale: Locale::Ja,
            notifications: true,
            ffmpeg_path: None,
            ytdlp_path: None,
            filename_template: "{name}_{date}".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum DuplicateAction {
    Overwrite,
    Rename,
    Skip,
    Ask,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum Theme {
    Dark,
    Light,
    System,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum Locale {
    Ja,
    En,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BinaryStatus {
    pub ffmpeg_installed: bool,
    pub ffmpeg_version: Option<String>,
    pub ffmpeg_path: Option<String>,
    pub ytdlp_installed: bool,
    pub ytdlp_version: Option<String>,
    pub ytdlp_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub ffmpeg_update_available: bool,
    pub ffmpeg_latest_version: Option<String>,
    pub ytdlp_update_available: bool,
    pub ytdlp_latest_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub cpu_cores: u32,
    pub total_memory: u64,
    pub gpu: Option<String>,
}
