use std::collections::HashMap;
use std::sync::Arc;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tokio::sync::Mutex;

// ── ステータス / タイプ ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Pending,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

// ── ジョブエントリ (Rust ↔ TypeScript) ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobEntry {
    pub id: String,
    pub job_type: JobType,
    pub status: JobStatus,
    pub input_path: String,
    pub output_path: String,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error: Option<String>,
}

// ── 内部管理構造体 ──────────────────────────────────────────────────────────

struct JobInner {
    entry: JobEntry,
    cancel_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

// ── JobQueue ────────────────────────────────────────────────────────────────

/// アプリ全体のジョブ状態を管理するキュー。
/// `Arc` ラップにより Tauri コマンド間で安全に共有・クローンできる。
#[derive(Clone)]
pub struct JobQueue {
    jobs: Arc<Mutex<HashMap<String, JobInner>>>,
}

impl JobQueue {
    pub fn new() -> Self {
        Self {
            jobs: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// ジョブを登録してキャンセル受信チャンネルを返す。
    /// 呼び出し元はこのチャンネルを対応するサービス関数に渡す。
    pub async fn add_job(
        &self,
        id: &str,
        job_type: JobType,
        input_path: &str,
        output_path: &str,
    ) -> tokio::sync::oneshot::Receiver<()> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        let now = Utc::now().to_rfc3339();
        let entry = JobEntry {
            id: id.to_string(),
            job_type,
            status: JobStatus::Running,
            input_path: input_path.to_string(),
            output_path: output_path.to_string(),
            created_at: now.clone(),
            started_at: Some(now),
            completed_at: None,
            error: None,
        };
        self.jobs.lock().await.insert(
            id.to_string(),
            JobInner {
                entry,
                cancel_tx: Some(tx),
            },
        );
        rx
    }

    /// ジョブを完了状態に更新する。
    pub async fn complete_job(&self, id: &str, output_path: &str) {
        let mut jobs = self.jobs.lock().await;
        if let Some(job) = jobs.get_mut(id) {
            job.entry.status = JobStatus::Completed;
            job.entry.completed_at = Some(Utc::now().to_rfc3339());
            if !output_path.is_empty() {
                job.entry.output_path = output_path.to_string();
            }
            job.cancel_tx = None;
        }
    }

    /// ジョブを失敗状態に更新する。
    pub async fn fail_job(&self, id: &str, error: &str) {
        let mut jobs = self.jobs.lock().await;
        if let Some(job) = jobs.get_mut(id) {
            job.entry.status = JobStatus::Failed;
            job.entry.completed_at = Some(Utc::now().to_rfc3339());
            job.entry.error = Some(error.to_string());
            job.cancel_tx = None;
        }
    }

    /// ジョブをキャンセルする (oneshot 送信 + ステータス変更)。
    pub async fn cancel(&self, id: &str) -> bool {
        let mut jobs = self.jobs.lock().await;
        if let Some(job) = jobs.get_mut(id) {
            if let Some(tx) = job.cancel_tx.take() {
                tx.send(()).ok();
            }
            if matches!(
                job.entry.status,
                JobStatus::Running | JobStatus::Paused | JobStatus::Pending
            ) {
                job.entry.status = JobStatus::Cancelled;
                job.entry.completed_at = Some(Utc::now().to_rfc3339());
                return true;
            }
        }
        false
    }

    /// 実行中のジョブを一時停止する (ステータス変更のみ; プロセス停止は未実装)。
    pub async fn pause(&self, id: &str) -> bool {
        let mut jobs = self.jobs.lock().await;
        if let Some(job) = jobs.get_mut(id) {
            if job.entry.status == JobStatus::Running {
                job.entry.status = JobStatus::Paused;
                return true;
            }
        }
        false
    }

    /// 一時停止中のジョブを再開する。
    pub async fn resume(&self, id: &str) -> bool {
        let mut jobs = self.jobs.lock().await;
        if let Some(job) = jobs.get_mut(id) {
            if job.entry.status == JobStatus::Paused {
                job.entry.status = JobStatus::Running;
                return true;
            }
        }
        false
    }

    /// 全ジョブを作成日時順で返す。
    pub async fn get_jobs(&self) -> Vec<JobEntry> {
        let jobs = self.jobs.lock().await;
        let mut entries: Vec<JobEntry> = jobs.values().map(|j| j.entry.clone()).collect();
        entries.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        entries
    }

    /// 完了/失敗/キャンセル済みジョブを削除し、削除件数を返す。
    pub async fn clear_completed(&self) -> usize {
        let mut jobs = self.jobs.lock().await;
        let before = jobs.len();
        jobs.retain(|_, j| {
            !matches!(
                j.entry.status,
                JobStatus::Completed | JobStatus::Failed | JobStatus::Cancelled
            )
        });
        before - jobs.len()
    }

    /// キュー状態変更を `job:queue-updated` イベントで通知する。
    pub async fn emit_queue_updated(&self, app: &AppHandle) {
        use tauri::Emitter;
        let jobs = self.get_jobs().await;
        app.emit("job:queue-updated", &jobs).ok();
    }
}
