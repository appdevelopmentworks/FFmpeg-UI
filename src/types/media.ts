/** メディアファイルの完全な情報 */
export interface MediaInfo {
  path: string;
  filename: string;
  format: FormatInfo;
  streams: StreamInfo[];
  duration: number; // 秒
  size: number; // バイト
  bitRate: number; // bps
}

/** コンテナフォーマット情報 */
export interface FormatInfo {
  name: string; // "mp4", "matroska", "avi"
  longName: string; // "QuickTime / MOV"
  formatTags: Record<string, string>;
}

/** ストリーム情報（映像/音声/字幕） */
export interface StreamInfo {
  index: number;
  streamType: StreamType;
  codecName: string;
  codecLongName: string;

  // Video specific
  width?: number;
  height?: number;
  fps?: number;
  pixFmt?: string;

  // Audio specific
  sampleRate?: number;
  channels?: number;
  channelLayout?: string;

  // Common
  bitRate?: number;
  duration?: number;
  language?: string;
  title?: string;
}

export type StreamType = 'video' | 'audio' | 'subtitle' | 'data';

/** サムネイルストリップデータ */
export interface ThumbnailStrip {
  paths: string[]; // サムネイル画像パスの配列
  interval: number; // 各サムネイルの間隔（秒）
  width: number;
  height: number;
}

/** 波形データ */
export interface WaveformData {
  samples: number[]; // -1.0 〜 1.0
  duration: number;
  sampleRate: number;
  channels: number;
}
