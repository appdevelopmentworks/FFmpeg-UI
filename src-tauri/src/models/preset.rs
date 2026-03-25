use super::ffmpeg::FFmpegCommand;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Preset {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: PresetCategory,
    pub is_builtin: bool,
    pub command: FFmpegCommand,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum PresetCategory {
    Web,
    Social,
    Archive,
    Audio,
    Custom,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PresetList {
    pub builtin: Vec<Preset>,
    pub user: Vec<Preset>,
}
