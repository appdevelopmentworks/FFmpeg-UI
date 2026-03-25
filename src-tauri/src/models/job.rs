use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Job {
    pub id: String,
    pub job_type: JobType,
    pub status: JobStatus,
    pub input_path: String,
    pub output_path: String,
    pub progress: Option<JobProgress>,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum JobType {
    Convert,
    Trim,
    Extract,
    Download,
    Filter,
    Batch,
    Stream,
    RawCommand,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Pending,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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
pub struct JobResult {
    pub output_path: String,
    pub duration_ms: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JobError {
    pub message: String,
    pub stderr: Option<String>,
}
