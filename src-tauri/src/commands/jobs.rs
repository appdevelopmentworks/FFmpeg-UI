use tauri::{AppHandle, State};

use crate::services::job_queue::{JobEntry, JobQueue};

/// 全ジョブ一覧を返す
#[tauri::command]
pub async fn get_jobs(queue: State<'_, JobQueue>) -> Result<Vec<JobEntry>, String> {
    Ok(queue.get_jobs().await)
}

/// ジョブをキャンセルする
#[tauri::command]
pub async fn cancel_job(
    app: AppHandle,
    queue: State<'_, JobQueue>,
    job_id: String,
) -> Result<(), String> {
    queue.cancel(&job_id).await;
    queue.emit_queue_updated(&app).await;
    Ok(())
}

/// ジョブを一時停止する
#[tauri::command]
pub async fn pause_job(
    app: AppHandle,
    queue: State<'_, JobQueue>,
    job_id: String,
) -> Result<(), String> {
    queue.pause(&job_id).await;
    queue.emit_queue_updated(&app).await;
    Ok(())
}

/// ジョブを再開する
#[tauri::command]
pub async fn resume_job(
    app: AppHandle,
    queue: State<'_, JobQueue>,
    job_id: String,
) -> Result<(), String> {
    queue.resume(&job_id).await;
    queue.emit_queue_updated(&app).await;
    Ok(())
}

/// 完了/失敗/キャンセル済みジョブを削除し、削除件数を返す
#[tauri::command]
pub async fn clear_completed_jobs(
    app: AppHandle,
    queue: State<'_, JobQueue>,
) -> Result<usize, String> {
    let count = queue.clear_completed().await;
    queue.emit_queue_updated(&app).await;
    Ok(count)
}

/// ジョブの順番を変更する (現在の HashMap 実装では順序保持のみ)
#[tauri::command]
pub async fn reorder_jobs(
    _app: AppHandle,
    _queue: State<'_, JobQueue>,
    _job_ids: Vec<String>,
) -> Result<(), String> {
    // HashMap ベースでは順序変更は未サポート。将来 VecDeque へ移行時に実装。
    Ok(())
}
