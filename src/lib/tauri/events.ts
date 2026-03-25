import { listen } from '@tauri-apps/api/event';
import type { JobProgress, JobResult, JobError, Job } from '@/types/job';
import type { DownloadProgress } from '@/types/ytdlp';

export interface SetupProgress {
  tool: string;
  percent: number;
  downloaded: number;
  total: number;
}

export interface SetupComplete {
  tool: string;
  version: string;
  path: string;
}

export interface SetupCheckResult {
  ffmpeg: boolean;
  ytdlp: boolean;
}

// ── Job Events ───────────────────────────────────────────────────────────────
export const onJobProgress = (
  jobId: string,
  callback: (progress: JobProgress) => void,
) => listen<JobProgress>(`job:progress:${jobId}`, (e) => callback(e.payload));

export const onJobComplete = (
  jobId: string,
  callback: (result: JobResult) => void,
) => listen<JobResult>(`job:complete:${jobId}`, (e) => callback(e.payload));

export const onJobError = (jobId: string, callback: (error: JobError) => void) =>
  listen<JobError>(`job:error:${jobId}`, (e) => callback(e.payload));

export const onQueueUpdated = (callback: (jobs: Job[]) => void) =>
  listen<Job[]>('job:queue-updated', (e) => callback(e.payload));

// ── Download Events ───────────────────────────────────────────────────────────
export const onDownloadProgress = (
  jobId: string,
  callback: (progress: DownloadProgress) => void,
) =>
  listen<DownloadProgress>(`download:progress:${jobId}`, (e) =>
    callback(e.payload),
  );

export const onDownloadComplete = (
  jobId: string,
  callback: (result: { outputPath: string; fileSize: number }) => void,
) =>
  listen<{ outputPath: string; fileSize: number }>(
    `download:complete:${jobId}`,
    (e) => callback(e.payload),
  );

export const onDownloadError = (
  jobId: string,
  callback: (error: { message: string }) => void,
) =>
  listen<{ message: string }>(`download:error:${jobId}`, (e) =>
    callback(e.payload),
  );

// ── Setup Events ─────────────────────────────────────────────────────────────
export const onSetupCheckResult = (callback: (result: SetupCheckResult) => void) =>
  listen<SetupCheckResult>('setup:check-result', (e) => callback(e.payload));

export const onSetupProgress = (callback: (progress: SetupProgress) => void) =>
  listen<SetupProgress>('setup:download-progress', (e) => callback(e.payload));

export const onSetupComplete = (callback: (result: SetupComplete) => void) =>
  listen<SetupComplete>('setup:download-complete', (e) => callback(e.payload));

export const onSetupError = (
  callback: (error: { tool: string; error: string }) => void,
) =>
  listen<{ tool: string; error: string }>('setup:download-error', (e) =>
    callback(e.payload),
  );

// ── Recording Events ──────────────────────────────────────────────────────────
export const onRecordingProgress = (
  jobId: string,
  callback: (progress: { elapsed: number; size: number }) => void,
) =>
  listen<{ elapsed: number; size: number }>(
    `recording:progress:${jobId}`,
    (e) => callback(e.payload),
  );
