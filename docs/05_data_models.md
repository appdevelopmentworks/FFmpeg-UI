# FFmpeg-UI データモデル定義書

> **ドキュメント番号**: 05
> **作成日**: 2026-03-25
> **バージョン**: 1.0

---

## 1. 概要

本書はフロントエンド (TypeScript) とバックエンド (Rust) の両方で使用する
データモデルを定義する。Tauri IPC を通じて JSON でシリアライズされる。

---

## 2. TypeScript 型定義

### 2.1 メディア関連

```typescript
// src/types/media.ts

/** メディアファイルの完全な情報 */
export interface MediaInfo {
  path: string;
  filename: string;
  format: FormatInfo;
  streams: StreamInfo[];
  duration: number;       // 秒
  size: number;           // バイト
  bitRate: number;        // bps
}

/** コンテナフォーマット情報 */
export interface FormatInfo {
  name: string;           // "mp4", "matroska", "avi"
  longName: string;       // "QuickTime / MOV"
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
  paths: string[];        // サムネイル画像パスの配列
  interval: number;       // 各サムネイルの間隔（秒）
  width: number;
  height: number;
}

/** 波形データ */
export interface WaveformData {
  samples: number[];      // -1.0 〜 1.0
  duration: number;
  sampleRate: number;
  channels: number;
}
```

### 2.2 FFmpegコマンド関連

```typescript
// src/types/ffmpeg.ts

/** FFmpegコマンドの全パラメータ */
export interface FFmpegCommand {
  inputPath: string;
  outputPath: string;
  videoCodec?: string;
  audioCodec?: string;
  videoBitrate?: string;
  audioBitrate?: string;
  resolution?: Resolution;
  fps?: number;
  crf?: number;
  preset?: EncoderPreset;
  hwAccel?: HWAccelType;
  filters: FilterSpec[];
  trim?: TrimSpec;
  extraArgs: string[];
  twoPass: boolean;
  container?: string;
  copyVideo: boolean;
  copyAudio: boolean;
  noVideo: boolean;
  noAudio: boolean;
}

export interface Resolution {
  width: number;
  height: number;
}

export interface TrimSpec {
  start: number;          // 秒
  end: number;            // 秒
  accurate: boolean;      // true=再エンコード, false=copy
}

/** フィルター定義 */
export interface FilterSpec {
  id: string;             // UUID
  name: string;           // FFmpegフィルター名
  displayName: string;    // UI表示名（i18n キー）
  category: FilterCategory;
  params: Record<string, string>;
  enabled: boolean;
  order: number;
}

export type FilterCategory = 'video' | 'audio';

/** ビルトインフィルター定義（カタログ用） */
export interface FilterDefinition {
  name: string;
  displayNameKey: string;
  category: FilterCategory;
  description: string;
  params: FilterParamDefinition[];
  preview: boolean;       // プレビュー対応か
}

export interface FilterParamDefinition {
  key: string;
  label: string;          // i18n キー
  type: 'number' | 'string' | 'select' | 'boolean' | 'range' | 'file';
  default: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  unit?: string;          // "px", "dB", "%", "x"
}

export type EncoderPreset =
  | 'ultrafast' | 'superfast' | 'veryfast' | 'faster'
  | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';

export type HWAccelType = 'nvenc' | 'qsv' | 'videotoolbox' | null;

/** ハードウェアエンコーダー情報 */
export interface HWEncoder {
  name: string;
  codec: string;
  device: string;
  available: boolean;
}

/** コーデック選択肢 */
export interface CodecOption {
  id: string;
  name: string;           // "H.264", "H.265/HEVC"
  ffmpegName: string;     // "libx264", "libx265"
  type: 'video' | 'audio';
  hwVariants?: string[];  // ["h264_nvenc", "h264_qsv"]
}

/** コンテナフォーマット選択肢 */
export interface ContainerOption {
  id: string;
  name: string;           // "MP4"
  extension: string;      // "mp4"
  supportedVideoCodecs: string[];
  supportedAudioCodecs: string[];
}
```

### 2.3 YouTube / yt-dlp 関連

```typescript
// src/types/ytdlp.ts

/** YouTube動画のメタ情報 */
export interface VideoInfo {
  id: string;
  title: string;
  description: string;
  channel: string;
  channelUrl: string;
  duration: number;       // 秒
  uploadDate: string;     // "20260320"
  viewCount: number;
  thumbnail: string;      // URL
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

export type DownloadStatus = 'downloading' | 'merging' | 'post-processing' | 'complete' | 'error';
```

### 2.4 ジョブ関連

```typescript
// src/types/job.ts

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
```

### 2.5 プリセット関連

```typescript
// src/types/preset.ts

/** プリセット */
export interface Preset {
  id: string;
  name: string;
  description: string;
  category: PresetCategory;
  isBuiltin: boolean;
  command: FFmpegCommand;
  createdAt?: string;
  updatedAt?: string;
}

export type PresetCategory = 'web' | 'social' | 'archive' | 'audio' | 'custom';

export interface PresetList {
  builtin: Preset[];
  user: Preset[];
}
```

### 2.6 設定関連

```typescript
// src/types/settings.ts

/** アプリ設定 */
export interface AppSettings {
  outputDir: string;
  duplicateAction: DuplicateAction;
  maxParallelJobs: number;
  theme: ThemeMode;
  locale: AppLocale;
  notifications: boolean;
  ffmpegPath?: string;
  ytdlpPath?: string;
  filenameTemplate: string;
}

export type DuplicateAction = 'overwrite' | 'rename' | 'skip' | 'ask';
export type ThemeMode = 'dark' | 'light' | 'system';
export type AppLocale = 'ja' | 'en';

/** セットアップ状態 */
export interface BinaryStatus {
  ffmpegInstalled: boolean;
  ffmpegVersion?: string;
  ffmpegPath?: string;
  ytdlpInstalled: boolean;
  ytdlpVersion?: string;
  ytdlpPath?: string;
}

/** アップデート情報 */
export interface UpdateInfo {
  ffmpegUpdateAvailable: boolean;
  ffmpegLatestVersion?: string;
  ytdlpUpdateAvailable: boolean;
  ytdlpLatestVersion?: string;
}

/** システム情報 */
export interface SystemInfo {
  os: string;
  arch: string;
  cpuCores: number;
  totalMemory: number;
  gpu?: string;
}
```

### 2.7 UI 状態関連

```typescript
// src/types/ui.ts

/** タブID */
export type TabId =
  | 'youtube'
  | 'convert'
  | 'trim'
  | 'extract'
  | 'filter'
  | 'batch'
  | 'stream'
  | 'command';

/** タブ定義 */
export interface TabDefinition {
  id: TabId;
  labelKey: string;       // i18n キー
  icon: string;           // Lucide icon 名
}

/** ファイルフィルター（ダイアログ用） */
export interface FileFilter {
  name: string;
  extensions: string[];
}

/** ストリーム抽出パラメータ */
export interface StreamExtraction {
  streamIndex: number;
  outputFormat: string;
  outputFilename?: string;
  options: Record<string, string>;
}

/** トリミングパラメータ */
export interface TrimParams {
  inputPath: string;
  outputPath: string;
  start: number;
  end: number;
  accurate: boolean;
  segments?: TrimSegment[];
}

export interface TrimSegment {
  start: number;
  end: number;
}

/** ストリーミング録画パラメータ */
export interface RecordingParams {
  url: string;
  outputPath: string;
  format?: string;
  durationLimit?: number;
}

/** ストリームプローブ結果 */
export interface StreamProbeResult {
  url: string;
  protocol: string;
  streams: StreamInfo[];
  isLive: boolean;
}

/** 出力ファイルサイズ推定パラメータ */
export interface EstimateParams {
  duration: number;
  videoBitrate?: number;
  audioBitrate?: number;
  crf?: number;
  codec?: string;
}

/** 抽出パラメータ */
export interface ExtractParams {
  inputPath: string;
  extractions: StreamExtraction[];
  outputDir: string;
}
```

---

## 3. Rust 型定義

### 3.1 モデル構造体

```rust
// src-tauri/src/models/media.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaInfo {
    pub path: String,
    pub filename: String,
    pub format: FormatInfo,
    pub streams: Vec<StreamInfo>,
    pub duration: f64,
    pub size: u64,
    pub bit_rate: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FormatInfo {
    pub name: String,
    pub long_name: String,
    pub format_tags: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamInfo {
    pub index: u32,
    pub stream_type: StreamType,
    pub codec_name: String,
    pub codec_long_name: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<f64>,
    pub pix_fmt: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
    pub channel_layout: Option<String>,
    pub bit_rate: Option<u64>,
    pub duration: Option<f64>,
    pub language: Option<String>,
    pub title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum StreamType {
    Video,
    Audio,
    Subtitle,
    Data,
}
```

```rust
// src-tauri/src/models/ffmpeg.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
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
pub struct Resolution {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FilterSpec {
    pub id: String,
    pub name: String,
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
```

```rust
// src-tauri/src/models/job.rs

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
```

```rust
// src-tauri/src/models/ytdlp.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub description: String,
    pub channel: String,
    pub channel_url: String,
    pub duration: f64,
    pub upload_date: String,
    pub view_count: u64,
    pub thumbnail: String,
    pub thumbnails: Vec<Thumbnail>,
    pub formats: Vec<DownloadFormat>,
    pub requested_subtitles: Option<HashMap<String, SubtitleInfo>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Thumbnail {
    pub url: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadFormat {
    pub format_id: String,
    pub format_note: String,
    pub ext: String,
    pub resolution: Option<String>,
    pub fps: Option<f64>,
    pub vcodec: Option<String>,
    pub acodec: Option<String>,
    pub video_bitrate: Option<f64>,
    pub audio_bitrate: Option<f64>,
    pub filesize: Option<u64>,
    pub filesize_approx: Option<u64>,
    pub has_video: bool,
    pub has_audio: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubtitleInfo {
    pub ext: String,
    pub url: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub percent: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub speed: Option<String>,
    pub eta: Option<String>,
    pub status: String,
}
```

```rust
// src-tauri/src/models/preset.rs

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
```

```rust
// src-tauri/src/models/settings.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub output_dir: String,
    pub duplicate_action: DuplicateAction,
    pub max_parallel_jobs: u32,
    pub theme: Theme,
    pub locale: Locale,
    pub notifications: bool,
    pub ffmpeg_path: Option<String>,
    pub ytdlp_path: Option<String>,
    pub filename_template: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            output_dir: dirs::download_dir()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            duplicate_action: DuplicateAction::Ask,
            max_parallel_jobs: 2,
            theme: Theme::Dark,
            locale: Locale::Ja,
            notifications: true,
            ffmpeg_path: None,
            ytdlp_path: None,
            filename_template: "{name}_{date}".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum DuplicateAction {
    Overwrite,
    Rename,
    Skip,
    Ask,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum Theme {
    Dark,
    Light,
    System,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum Locale {
    Ja,
    En,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BinaryStatus {
    pub ffmpeg_installed: bool,
    pub ffmpeg_version: Option<String>,
    pub ffmpeg_path: Option<String>,
    pub ytdlp_installed: bool,
    pub ytdlp_version: Option<String>,
    pub ytdlp_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub cpu_cores: u32,
    pub total_memory: u64,
    pub gpu: Option<String>,
}
```

---

## 4. ビルトインプリセット定義

```typescript
// src/lib/ffmpeg/builtinPresets.ts

export const BUILTIN_PRESETS: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // === Web ===
  {
    name: 'Web向け (H.264/AAC)',
    description: 'ブラウザ互換性の高いMP4。ストリーミング対応。',
    category: 'web',
    isBuiltin: true,
    command: {
      inputPath: '', outputPath: '',
      videoCodec: 'libx264', audioCodec: 'aac',
      audioBitrate: '192k', crf: 23, preset: 'medium',
      container: 'mp4', filters: [], extraArgs: ['-movflags', '+faststart'],
      twoPass: false, copyVideo: false, copyAudio: false,
      noVideo: false, noAudio: false,
    },
  },
  {
    name: 'Web向け (VP9/Opus)',
    description: 'WebM形式。Chrome/Firefox向け。高圧縮。',
    category: 'web',
    isBuiltin: true,
    command: {
      inputPath: '', outputPath: '',
      videoCodec: 'libvpx-vp9', audioCodec: 'libopus',
      audioBitrate: '128k', crf: 30,
      container: 'webm', filters: [], extraArgs: ['-b:v', '0'],
      twoPass: false, copyVideo: false, copyAudio: false,
      noVideo: false, noAudio: false,
    },
  },

  // === Social ===
  {
    name: 'Twitter/X 向け',
    description: 'Twitter投稿に最適化 (1280x720, 40秒以内推奨)',
    category: 'social',
    isBuiltin: true,
    command: {
      inputPath: '', outputPath: '',
      videoCodec: 'libx264', audioCodec: 'aac',
      audioBitrate: '128k', crf: 23, preset: 'fast',
      resolution: { width: 1280, height: 720 },
      container: 'mp4', filters: [], extraArgs: ['-movflags', '+faststart', '-pix_fmt', 'yuv420p'],
      twoPass: false, copyVideo: false, copyAudio: false,
      noVideo: false, noAudio: false,
    },
  },
  {
    name: 'Instagram リール向け',
    description: '9:16 縦型動画、1080x1920',
    category: 'social',
    isBuiltin: true,
    command: {
      inputPath: '', outputPath: '',
      videoCodec: 'libx264', audioCodec: 'aac',
      audioBitrate: '192k', crf: 23, preset: 'medium',
      resolution: { width: 1080, height: 1920 },
      container: 'mp4', filters: [], extraArgs: ['-movflags', '+faststart', '-pix_fmt', 'yuv420p'],
      twoPass: false, copyVideo: false, copyAudio: false,
      noVideo: false, noAudio: false,
    },
  },

  // === Archive ===
  {
    name: 'アーカイブ (高品質)',
    description: 'ほぼ無劣化。ファイルサイズ大。',
    category: 'archive',
    isBuiltin: true,
    command: {
      inputPath: '', outputPath: '',
      videoCodec: 'libx264', audioCodec: 'flac',
      crf: 10, preset: 'slow',
      container: 'mkv', filters: [], extraArgs: [],
      twoPass: false, copyVideo: false, copyAudio: false,
      noVideo: false, noAudio: false,
    },
  },
  {
    name: 'コンテナ変換のみ (再エンコードなし)',
    description: 'コーデックを変更せずコンテナのみ変換。高速。',
    category: 'archive',
    isBuiltin: true,
    command: {
      inputPath: '', outputPath: '',
      container: 'mp4', filters: [], extraArgs: [],
      twoPass: false, copyVideo: true, copyAudio: true,
      noVideo: false, noAudio: false,
    },
  },

  // === Audio ===
  {
    name: 'MP3 抽出 (高品質)',
    description: '320kbps MP3。音楽向け。',
    category: 'audio',
    isBuiltin: true,
    command: {
      inputPath: '', outputPath: '',
      audioCodec: 'libmp3lame', audioBitrate: '320k',
      container: 'mp3', filters: [], extraArgs: ['-q:a', '0'],
      twoPass: false, copyVideo: false, copyAudio: false,
      noVideo: true, noAudio: false,
    },
  },
  {
    name: 'FLAC 抽出 (ロスレス)',
    description: '無劣化音声抽出。',
    category: 'audio',
    isBuiltin: true,
    command: {
      inputPath: '', outputPath: '',
      audioCodec: 'flac',
      container: 'flac', filters: [], extraArgs: [],
      twoPass: false, copyVideo: false, copyAudio: false,
      noVideo: true, noAudio: false,
    },
  },
  {
    name: 'AAC 抽出 (標準)',
    description: '192kbps AAC。汎用音声。',
    category: 'audio',
    isBuiltin: true,
    command: {
      inputPath: '', outputPath: '',
      audioCodec: 'aac', audioBitrate: '192k',
      container: 'm4a', filters: [], extraArgs: [],
      twoPass: false, copyVideo: false, copyAudio: false,
      noVideo: true, noAudio: false,
    },
  },
];
```

---

## 5. フィルターカタログ定義

```typescript
// src/lib/ffmpeg/filterCatalog.ts

export const FILTER_CATALOG: FilterDefinition[] = [
  // === Video Filters ===
  {
    name: 'crop',
    displayNameKey: 'filter.crop',
    category: 'video',
    description: '映像の一部を切り取り',
    preview: true,
    params: [
      { key: 'w', label: 'filter.crop.width', type: 'number', default: 1280, min: 1 },
      { key: 'h', label: 'filter.crop.height', type: 'number', default: 720, min: 1 },
      { key: 'x', label: 'filter.crop.x', type: 'number', default: 0, min: 0 },
      { key: 'y', label: 'filter.crop.y', type: 'number', default: 0, min: 0 },
    ],
  },
  {
    name: 'scale',
    displayNameKey: 'filter.scale',
    category: 'video',
    description: '解像度変更',
    preview: true,
    params: [
      { key: 'w', label: 'filter.scale.width', type: 'number', default: -1 },
      { key: 'h', label: 'filter.scale.height', type: 'number', default: 720 },
      { key: 'flags', label: 'filter.scale.algorithm', type: 'select', default: 'lanczos',
        options: [
          { value: 'lanczos', label: 'Lanczos' },
          { value: 'bicubic', label: 'Bicubic' },
          { value: 'bilinear', label: 'Bilinear' },
        ],
      },
    ],
  },
  {
    name: 'transpose',
    displayNameKey: 'filter.rotate',
    category: 'video',
    description: '回転・反転',
    preview: true,
    params: [
      { key: 'dir', label: 'filter.rotate.direction', type: 'select', default: '1',
        options: [
          { value: '1', label: '90° 時計回り' },
          { value: '2', label: '90° 反時計回り' },
          { value: '0', label: '90° 反時計回り + 垂直反転' },
          { value: '3', label: '90° 時計回り + 垂直反転' },
        ],
      },
    ],
  },
  {
    name: 'eq',
    displayNameKey: 'filter.colorCorrection',
    category: 'video',
    description: '色調補正',
    preview: true,
    params: [
      { key: 'brightness', label: 'filter.eq.brightness', type: 'range', default: 0, min: -1, max: 1, step: 0.01 },
      { key: 'contrast', label: 'filter.eq.contrast', type: 'range', default: 1, min: 0, max: 3, step: 0.01 },
      { key: 'saturation', label: 'filter.eq.saturation', type: 'range', default: 1, min: 0, max: 3, step: 0.01 },
      { key: 'gamma', label: 'filter.eq.gamma', type: 'range', default: 1, min: 0.1, max: 10, step: 0.1 },
    ],
  },
  {
    name: 'boxblur',
    displayNameKey: 'filter.blur',
    category: 'video',
    description: 'ぼかし',
    preview: true,
    params: [
      { key: 'luma_radius', label: 'filter.blur.radius', type: 'range', default: 2, min: 0, max: 20, step: 1, unit: 'px' },
    ],
  },
  {
    name: 'hqdn3d',
    displayNameKey: 'filter.denoise',
    category: 'video',
    description: 'ノイズ除去（高品質）',
    preview: true,
    params: [
      { key: 'luma_spatial', label: 'filter.denoise.strength', type: 'range', default: 4, min: 0, max: 20, step: 0.5 },
    ],
  },
  {
    name: 'subtitles',
    displayNameKey: 'filter.subtitles',
    category: 'video',
    description: '字幕焼き込み',
    preview: false,
    params: [
      { key: 'filename', label: 'filter.subtitles.file', type: 'file', default: '' },
    ],
  },
  {
    name: 'drawtext',
    displayNameKey: 'filter.textOverlay',
    category: 'video',
    description: 'テキストオーバーレイ',
    preview: true,
    params: [
      { key: 'text', label: 'filter.drawtext.text', type: 'string', default: '' },
      { key: 'fontsize', label: 'filter.drawtext.size', type: 'number', default: 24, min: 8, max: 200 },
      { key: 'fontcolor', label: 'filter.drawtext.color', type: 'string', default: 'white' },
      { key: 'x', label: 'filter.drawtext.x', type: 'string', default: '(w-text_w)/2' },
      { key: 'y', label: 'filter.drawtext.y', type: 'string', default: '(h-text_h)/2' },
    ],
  },
  {
    name: 'fade',
    displayNameKey: 'filter.fade',
    category: 'video',
    description: 'フェードイン/アウト',
    preview: false,
    params: [
      { key: 't', label: 'filter.fade.type', type: 'select', default: 'in',
        options: [
          { value: 'in', label: 'フェードイン' },
          { value: 'out', label: 'フェードアウト' },
        ],
      },
      { key: 'st', label: 'filter.fade.start', type: 'number', default: 0, min: 0, unit: '秒' },
      { key: 'd', label: 'filter.fade.duration', type: 'number', default: 1, min: 0.1, step: 0.1, unit: '秒' },
    ],
  },
  {
    name: 'setpts',
    displayNameKey: 'filter.speed',
    category: 'video',
    description: '再生速度変更',
    preview: false,
    params: [
      { key: 'expr', label: 'filter.speed.factor', type: 'select', default: '0.5*PTS',
        options: [
          { value: '4*PTS', label: '0.25x (4倍スロー)' },
          { value: '2*PTS', label: '0.5x (2倍スロー)' },
          { value: 'PTS', label: '1x (等速)' },
          { value: '0.5*PTS', label: '2x (2倍速)' },
          { value: '0.25*PTS', label: '4x (4倍速)' },
        ],
      },
    ],
  },

  // === Audio Filters ===
  {
    name: 'volume',
    displayNameKey: 'filter.volume',
    category: 'audio',
    description: '音量調整',
    preview: false,
    params: [
      { key: 'volume', label: 'filter.volume.level', type: 'range', default: 1.0, min: 0, max: 5, step: 0.1, unit: 'x' },
    ],
  },
  {
    name: 'loudnorm',
    displayNameKey: 'filter.normalize',
    category: 'audio',
    description: 'ラウドネスノーマライズ (EBU R128)',
    preview: false,
    params: [
      { key: 'I', label: 'filter.normalize.target', type: 'number', default: -14, min: -70, max: -5, unit: 'LUFS' },
    ],
  },
  {
    name: 'afftdn',
    displayNameKey: 'filter.audioNoisereduction',
    category: 'audio',
    description: '音声ノイズ除去 (FFT)',
    preview: false,
    params: [
      { key: 'nr', label: 'filter.audioNoisereduction.amount', type: 'range', default: 12, min: 0.01, max: 97, step: 1, unit: 'dB' },
    ],
  },
  {
    name: 'atempo',
    displayNameKey: 'filter.audioSpeed',
    category: 'audio',
    description: '音声速度変更 (ピッチ維持)',
    preview: false,
    params: [
      { key: 'tempo', label: 'filter.audioSpeed.factor', type: 'range', default: 1.0, min: 0.5, max: 2.0, step: 0.05, unit: 'x' },
    ],
  },
  {
    name: 'pan',
    displayNameKey: 'filter.channelLayout',
    category: 'audio',
    description: 'チャンネル変更',
    preview: false,
    params: [
      { key: 'layout', label: 'filter.channelLayout.mode', type: 'select', default: 'stereo|c0=c0+c1|c1=c0+c1',
        options: [
          { value: 'stereo|c0=c0+c1|c1=c0+c1', label: 'モノラル → ステレオ' },
          { value: 'mono|c0=0.5*c0+0.5*c1', label: 'ステレオ → モノラル' },
        ],
      },
    ],
  },
];
```

---

## 6. i18n メッセージ構造

```typescript
// src/lib/i18n/ja.json (構造定義、実際の値は実装時に定義)
{
  "app": {
    "name": "FFmpeg-UI",
    "settings": "設定"
  },
  "tabs": {
    "youtube": "YouTube",
    "convert": "変換",
    "trim": "カット",
    "extract": "分離",
    "filter": "フィルター",
    "batch": "バッチ",
    "stream": "ストリーム",
    "command": "コマンド"
  },
  "youtube": {
    "urlPlaceholder": "YouTube URL を入力またはペースト",
    "fetch": "取得",
    "format": "フォーマット",
    "quality": "品質",
    "download": "ダウンロード開始",
    "videoAndAudio": "映像+音声",
    "videoOnly": "映像のみ",
    "audioOnly": "音声のみ"
  },
  "convert": {
    "dropzone": "ファイルをドラッグ&ドロップ または クリックして選択",
    "outputSettings": "出力設定",
    "preset": "プリセット",
    "container": "コンテナ",
    "videoCodec": "映像コーデック",
    "audioCodec": "音声コーデック",
    "resolution": "解像度",
    "bitrate": "ビットレート",
    "keepOriginal": "元のサイズを維持",
    "commandPreview": "コマンドプレビュー",
    "estimatedSize": "推定出力サイズ",
    "startConversion": "変換開始"
  },
  "trim": {
    "start": "開始",
    "end": "終了",
    "duration": "選択範囲",
    "fastCut": "高速カット (再エンコードなし)",
    "accurateCut": "精密カット (再エンコードあり)",
    "execute": "カット実行"
  },
  "extract": {
    "streams": "ストリーム一覧",
    "video": "映像",
    "audio": "音声",
    "subtitle": "字幕",
    "outputFormat": "出力フォーマット",
    "execute": "選択したストリームを抽出"
  },
  "filter": {
    "catalog": "フィルターカタログ",
    "chain": "フィルターチェーン",
    "parameters": "パラメータ",
    "search": "検索",
    "videoFilters": "映像フィルター",
    "audioFilters": "音声フィルター",
    "apply": "フィルター適用",
    "savePreset": "プリセット保存",
    "crop": "クロップ",
    "scale": "スケール",
    "rotate": "回転",
    "colorCorrection": "色調補正",
    "blur": "ぼかし",
    "denoise": "ノイズ除去",
    "subtitles": "字幕焼き込み",
    "textOverlay": "テキスト",
    "fade": "フェード",
    "speed": "速度変更"
  },
  "batch": {
    "dropMultiple": "複数ファイルをドラッグ&ドロップ",
    "selectFolder": "フォルダ選択",
    "commonSettings": "共通処理設定",
    "filenameTemplate": "ファイル名テンプレート",
    "parallelJobs": "並列処理数",
    "execute": "バッチ処理開始"
  },
  "jobs": {
    "queue": "ジョブキュー",
    "completed": "完了",
    "pending": "待機中",
    "running": "処理中",
    "paused": "一時停止",
    "failed": "失敗",
    "cancelled": "キャンセル",
    "remaining": "残り",
    "cancel": "キャンセル",
    "cancelAll": "全キャンセル",
    "openFolder": "処理済みフォルダを開く"
  },
  "settings": {
    "general": "一般",
    "output": "出力",
    "performance": "パフォーマンス",
    "tools": "ツール",
    "data": "データ",
    "theme": "テーマ",
    "language": "言語",
    "notifications": "通知",
    "defaultOutput": "デフォルト出力先",
    "duplicateAction": "同名ファイル時の動作",
    "parallelJobs": "並列処理数",
    "checkUpdate": "アップデート確認",
    "export": "エクスポート",
    "import": "インポート",
    "reset": "リセット",
    "save": "保存",
    "cancel": "キャンセル"
  },
  "setup": {
    "title": "セットアップ",
    "description": "FFmpeg-UIの利用に必要なツールをダウンロードします。",
    "downloading": "ダウンロード中...",
    "complete": "完了",
    "skip": "スキップ",
    "retry": "リトライ"
  },
  "common": {
    "outputDir": "出力先",
    "change": "変更...",
    "filename": "ファイル名",
    "copy": "コピー",
    "edit": "編集",
    "delete": "削除",
    "add": "追加",
    "close": "閉じる",
    "confirm": "確認",
    "error": "エラー"
  }
}
```
