use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JobProgress {
    pub percent: f64,
    pub frame: u64,
    pub fps: f64,
    pub bitrate: String,
    pub total_size: u64,
    pub current_time: f64,
    pub speed: String,
    pub eta: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FFmpegCommand {
    pub input_path: String,
    pub output_path: String,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub video_bitrate: Option<String>,
    pub audio_bitrate: Option<String>,
    pub resolution: Option<Resolution>,
    pub fps: Option<f64>,
    pub crf: Option<u32>,
    pub preset: Option<String>,
    pub hw_accel: Option<String>,
    pub filters: Vec<FilterSpec>,
    pub trim: Option<TrimSpec>,
    pub extra_args: Vec<String>,
    pub two_pass: bool,
    pub container: Option<String>,
    pub copy_video: bool,
    pub copy_audio: bool,
    pub no_video: bool,
    pub no_audio: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Resolution {
    pub width: u32,
    pub height: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub algorithm: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ai_model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ai_scale: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FilterSpec {
    pub id: String,
    pub name: String,
    pub category: Option<String>,   // "video" | "audio"
    pub params: HashMap<String, String>,
    pub enabled: bool,
    pub order: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrimSpec {
    pub start: f64,
    pub end: f64,
    pub accurate: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HWEncoder {
    pub name: String,
    pub codec: String,
    pub device: String,
    pub available: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StreamExtraction {
    pub stream_index: u32,
    pub output_format: String,
    pub output_filename: Option<String>,
    pub options: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrimSegment {
    pub start: f64,
    pub end: f64,
}
