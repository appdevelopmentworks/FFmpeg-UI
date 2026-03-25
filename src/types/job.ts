/** ジョブ */
export interface Job {
  id: string;
  jobType: JobType;
  status: JobStatus;
  inputPath: string;
  outputPath: string;
  progress?: JobProgress;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export type JobType =
  | 'convert'
  | 'trim'
  | 'extract'
  | 'download'
  | 'filter'
  | 'batch'
  | 'stream'
  | 'raw_command';

export type JobStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** ジョブ進捗 */
export interface JobProgress {
  percent: number;
  frame: number;
  fps: number;
  bitrate: string;
  totalSize: number;
  currentTime: number;
  speed: string;
  eta?: string;
}

/** ジョブ完了結果 */
export interface JobResult {
  outputPath: string;
  durationMs: number;
}

/** ジョブエラー */
export interface JobError {
  message: string;
  stderr?: string;
}
