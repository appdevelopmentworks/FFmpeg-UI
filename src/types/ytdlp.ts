/** YouTube動画のメタ情報 */
export interface VideoInfo {
  id: string;
  title: string;
  description: string;
  channel: string;
  channelUrl: string;
  duration: number; // 秒
  uploadDate: string; // "20260320"
  viewCount: number;
  thumbnail: string; // URL
  thumbnails: Thumbnail[];
  formats: DownloadFormat[];
  requestedSubtitles?: Record<string, SubtitleInfo>;
}

export interface Thumbnail {
  url: string;
  width: number;
  height: number;
}

/** ダウンロードフォーマット */
export interface DownloadFormat {
  formatId: string;
  formatNote: string;
  ext: string;
  resolution?: string;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  videoBitrate?: number;
  audioBitrate?: number;
  filesize?: number;
  filesizeApprox?: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface SubtitleInfo {
  ext: string;
  url: string;
  name: string;
}

/** ダウンロードパラメータ */
export interface DownloadParams {
  url: string;
  formatId: string;
  outputDir: string;
  filename?: string;
  mergeFormat?: string;
}

/** ダウンロード進捗 */
export interface DownloadProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes?: number;
  speed?: string;
  eta?: string;
  status: DownloadStatus;
}

export type DownloadStatus =
  | 'downloading'
  | 'merging'
  | 'post-processing'
  | 'complete'
  | 'error';
