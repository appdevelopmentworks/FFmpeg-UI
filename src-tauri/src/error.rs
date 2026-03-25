use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("FFmpeg error: {message}")]
    FFmpeg { message: String, stderr: String },

    #[error("yt-dlp error: {message}")]
    YtDlp { message: String, stderr: String },

    #[error("Binary not found: {tool}")]
    BinaryNotFound { tool: String },

    #[error("Download failed: {message}")]
    DownloadFailed { message: String },

    #[error("File not found: {path}")]
    FileNotFound { path: String },

    #[error("Invalid input: {message}")]
    InvalidInput { message: String },

    #[error("Process cancelled")]
    Cancelled,

    #[error("Checksum mismatch: expected {expected}, got {actual}")]
    ChecksumMismatch { expected: String, actual: String },

    #[error("Archive error: {0}")]
    Archive(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("Network error: {0}")]
    Network(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Network(e.to_string())
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(e: zip::result::ZipError) -> Self {
        AppError::Archive(e.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
