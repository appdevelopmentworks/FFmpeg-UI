# FFmpeg-UI Tauri コマンド API 設計書

> **ドキュメント番号**: 04
> **作成日**: 2026-03-25
> **バージョン**: 1.0

---

## 1. API概要

Tauri 2 の `invoke()` / `listen()` / `emit()` を使用した IPC 通信。
フロントエンド (TypeScript) ↔ バックエンド (Rust) の全コマンド定義。

### 命名規則
- コマンド名: `snake_case` (Rust側) → フロントエンドでも同名で `invoke`
- イベント名: `namespace:event-name` (kebab-case)
- 戻り値: `Result<T, String>` (Rust) → `Promise<T>` (TypeScript)

---

## 2. セットアップ API

### 2.1 check_binaries
バイナリの存在確認とバージョン取得

```rust
#[tauri::command]
async fn check_binaries() -> Result<BinaryStatus, String>

// Response
struct BinaryStatus {
    ffmpeg_installed: bool,
    ffmpeg_version: Option<String>,   // "7.1"
    ffmpeg_path: Option<String>,
    ytdlp_installed: bool,
    ytdlp_version: Option<String>,    // "2026.03.15"
    ytdlp_path: Option<String>,
}
```

```typescript
// Frontend
const status = await invoke<BinaryStatus>('check_binaries');
```

### 2.2 download_binary
バイナリのダウンロード開始（進捗はイベントで通知）

```rust
#[tauri::command]
async fn download_binary(
    app: AppHandle,
    tool: String,  // "ffmpeg" | "ytdlp"
) -> Result<String, String>  // ダウンロード完了後のパスを返す

// Events emitted:
// "setup:download-progress" → { tool: String, percent: f64, downloaded: u64, total: u64 }
// "setup:download-complete" → { tool: String, version: String, path: String }
// "setup:download-error"    → { tool: String, error: String }
```

```typescript
// Frontend
await invoke('download_binary', { tool: 'ffmpeg' });
const unlisten = await listen<DownloadProgress>('setup:download-progress', (e) => {
  console.log(`${e.payload.tool}: ${e.payload.percent}%`);
});
```

### 2.3 check_updates
バイナリの更新確認

```rust
#[tauri::command]
async fn check_updates() -> Result<UpdateInfo, String>

struct UpdateInfo {
    ffmpeg_update_available: bool,
    ffmpeg_latest_version: Option<String>,
    ytdlp_update_available: bool,
    ytdlp_latest_version: Option<String>,
}
```

---

## 3. メディア情報 API

### 3.1 probe_media
ffprobe でメディアファイルの詳細情報取得

```rust
#[tauri::command]
async fn probe_media(path: String) -> Result<MediaInfo, String>

struct MediaInfo {
    path: String,
    filename: String,
    format: FormatInfo,
    streams: Vec<StreamInfo>,
    duration: f64,           // 秒
    size: u64,               // バイト
    bit_rate: u64,           // bps
}

struct FormatInfo {
    name: String,            // "mp4"
    long_name: String,       // "QuickTime / MOV"
    format_tags: HashMap<String, String>,
}

struct StreamInfo {
    index: u32,
    stream_type: StreamType, // "video" | "audio" | "subtitle"
    codec_name: String,      // "h264"
    codec_long_name: String, // "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10"

    // Video specific
    width: Option<u32>,
    height: Option<u32>,
    fps: Option<f64>,
    pix_fmt: Option<String>,

    // Audio specific
    sample_rate: Option<u32>,
    channels: Option<u32>,
    channel_layout: Option<String>,  // "stereo"

    // Common
    bit_rate: Option<u64>,
    duration: Option<f64>,
    language: Option<String>,
    title: Option<String>,
}

enum StreamType {
    Video,
    Audio,
    Subtitle,
    Data,
}
```

```typescript
// Frontend
const info = await invoke<MediaInfo>('probe_media', { path: '/path/to/video.mp4' });
```

### 3.2 generate_thumbnails
タイムラインサムネイルストリップ生成

```rust
#[tauri::command]
async fn generate_thumbnails(
    app: AppHandle,
    path: String,
    count: u32,        // 生成枚数 (default: 20)
    width: u32,        // サムネイル幅 (default: 160)
    height: u32,       // サムネイル高さ (default: 90)
) -> Result<Vec<String>, String>  // サムネイル画像パスの配列

// 進捗イベント:
// "thumbnails:progress" → { current: u32, total: u32 }
```

### 3.3 generate_waveform
音声波形データ生成

```rust
#[tauri::command]
async fn generate_waveform(
    path: String,
    samples: u32,      // ダウンサンプル後のサンプル数 (default: 1000)
) -> Result<WaveformData, String>

struct WaveformData {
    samples: Vec<f32>,     // -1.0 〜 1.0 の正規化済みサンプル
    duration: f64,
    sample_rate: u32,
    channels: u32,
}
```

---

## 4. YouTube / yt-dlp API

### 4.1 fetch_video_info
YouTube URL からメタデータ取得

```rust
#[tauri::command]
async fn fetch_video_info(url: String) -> Result<VideoInfo, String>

struct VideoInfo {
    id: String,
    title: String,
    description: String,
    channel: String,
    channel_url: String,
    duration: f64,
    upload_date: String,        // "20260320"
    view_count: u64,
    thumbnail: String,          // URL
    thumbnails: Vec<Thumbnail>,
    formats: Vec<DownloadFormat>,
    requested_subtitles: Option<HashMap<String, SubtitleInfo>>,
}

struct Thumbnail {
    url: String,
    width: u32,
    height: u32,
}

struct DownloadFormat {
    format_id: String,
    format_note: String,        // "1080p", "720p", "medium"
    ext: String,                // "mp4", "webm"
    resolution: Option<String>, // "1920x1080"
    fps: Option<f64>,
    vcodec: Option<String>,     // "h264", "vp9", "none"
    acodec: Option<String>,     // "aac", "opus", "none"
    video_bitrate: Option<f64>,
    audio_bitrate: Option<f64>,
    filesize: Option<u64>,
    filesize_approx: Option<u64>,
    has_video: bool,
    has_audio: bool,
}

struct SubtitleInfo {
    ext: String,
    url: String,
    name: String,
}
```

### 4.2 start_download
ダウンロード開始

```rust
#[tauri::command]
async fn start_download(
    app: AppHandle,
    url: String,
    format_id: String,          // "137+140" or "bestvideo+bestaudio"
    output_dir: String,
    filename: Option<String>,   // None = yt-dlp デフォルト
    merge_format: Option<String>, // "mp4"
) -> Result<String, String>     // ジョブID

// Events:
// "download:progress:{job_id}" → DownloadProgress
// "download:complete:{job_id}" → { output_path: String, file_size: u64 }
// "download:error:{job_id}"    → { message: String }

struct DownloadProgress {
    percent: f64,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    speed: Option<String>,      // "12.3MiB/s"
    eta: Option<String>,        // "00:45"
    status: String,             // "downloading", "merging", "post-processing"
}
```

### 4.3 cancel_download
ダウンロードキャンセル

```rust
#[tauri::command]
async fn cancel_download(job_id: String) -> Result<(), String>
```

### 4.4 get_preview_url
プレビュー用ストリームURL取得

```rust
#[tauri::command]
async fn get_preview_url(url: String) -> Result<String, String>
// yt-dlp -g でストリームURLを取得
```

---

## 5. FFmpeg 処理 API

### 5.1 execute_ffmpeg
FFmpegコマンドの実行（ジョブキュー経由）

```rust
#[tauri::command]
async fn execute_ffmpeg(
    app: AppHandle,
    command: FFmpegCommand,
) -> Result<String, String>  // ジョブID

struct FFmpegCommand {
    input_path: String,
    output_path: String,
    video_codec: Option<String>,
    audio_codec: Option<String>,
    video_bitrate: Option<String>,
    audio_bitrate: Option<String>,
    resolution: Option<Resolution>,
    fps: Option<f64>,
    crf: Option<u32>,
    preset: Option<String>,          // "ultrafast" ... "veryslow"
    hw_accel: Option<String>,        // "nvenc", "qsv", "videotoolbox"
    filters: Vec<FilterSpec>,
    trim: Option<TrimSpec>,
    extra_args: Vec<String>,         // 追加の引数（直接編集モード用）
    two_pass: bool,
    container: Option<String>,       // 出力コンテナ
    copy_video: bool,                // -c:v copy
    copy_audio: bool,                // -c:a copy
    no_video: bool,                  // -vn
    no_audio: bool,                  // -an
}

struct Resolution {
    width: u32,
    height: u32,
}

struct FilterSpec {
    name: String,            // "crop", "scale", "eq", etc.
    params: HashMap<String, String>,
    enabled: bool,
}

struct TrimSpec {
    start: f64,              // 秒
    end: f64,                // 秒
    accurate: bool,          // true = 再エンコード, false = -c copy
}

// Events:
// "job:progress:{job_id}" → JobProgress
// "job:complete:{job_id}" → { output_path: String, duration_ms: u64 }
// "job:error:{job_id}"    → { message: String, stderr: String }

struct JobProgress {
    percent: f64,
    frame: u64,
    fps: f64,
    bitrate: String,         // "5678kbits/s"
    total_size: u64,
    current_time: f64,       // 現在処理中の時間位置（秒）
    speed: String,           // "1.5x"
    eta: Option<String>,
}
```

### 5.2 execute_raw_command
生のFFmpegコマンド文字列を実行（コマンドタブ用）

```rust
#[tauri::command]
async fn execute_raw_command(
    app: AppHandle,
    command_string: String,
) -> Result<String, String>  // ジョブID
// コマンド文字列をパースして安全に実行
// 入力パス、出力パスを自動検出して進捗計算
```

### 5.3 extract_streams
ストリーム分離・抽出

```rust
#[tauri::command]
async fn extract_streams(
    app: AppHandle,
    input_path: String,
    extractions: Vec<StreamExtraction>,
    output_dir: String,
) -> Result<String, String>  // ジョブID

struct StreamExtraction {
    stream_index: u32,
    output_format: String,   // "mp3", "aac", "mp4", "srt"
    output_filename: Option<String>,
    options: HashMap<String, String>,  // コーデック固有オプション
}
```

### 5.4 trim_media
メディアのトリミング

```rust
#[tauri::command]
async fn trim_media(
    app: AppHandle,
    input_path: String,
    output_path: String,
    start: f64,
    end: f64,
    accurate: bool,    // true=再エンコード, false=copy
    segments: Option<Vec<TrimSegment>>,  // マルチセグメント
) -> Result<String, String>  // ジョブID

struct TrimSegment {
    start: f64,
    end: f64,
}
```

### 5.5 detect_hw_encoders
ハードウェアエンコーダーの検出

```rust
#[tauri::command]
async fn detect_hw_encoders() -> Result<Vec<HWEncoder>, String>

struct HWEncoder {
    name: String,        // "h264_nvenc", "h264_qsv", "h264_videotoolbox"
    codec: String,       // "h264"
    device: String,      // "NVIDIA GeForce RTX 5090"
    available: bool,
}
```

### 5.6 build_command_preview
設定からFFmpegコマンド文字列を生成（プレビュー用、実行しない）

```rust
#[tauri::command]
fn build_command_preview(command: FFmpegCommand) -> Result<String, String>
// FFmpegCommandからコマンド文字列を生成して返す
// UIのコマンドプレビュー表示に使用
```

### 5.7 estimate_output_size
出力ファイルサイズの推定

```rust
#[tauri::command]
fn estimate_output_size(
    duration: f64,
    video_bitrate: Option<u64>,
    audio_bitrate: Option<u64>,
    crf: Option<u32>,
    codec: Option<String>,
) -> Result<u64, String>  // 推定バイト数
```

---

## 6. ジョブキュー API

### 6.1 get_jobs
全ジョブの状態取得

```rust
#[tauri::command]
async fn get_jobs() -> Result<Vec<Job>, String>

struct Job {
    id: String,
    job_type: JobType,
    status: JobStatus,
    input_path: String,
    output_path: String,
    progress: Option<JobProgress>,
    created_at: String,       // ISO 8601
    started_at: Option<String>,
    completed_at: Option<String>,
    error: Option<String>,
}

enum JobType {
    Convert,
    Trim,
    Extract,
    Download,
    Filter,
    Batch,
    Stream,
    RawCommand,
}

enum JobStatus {
    Pending,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}
```

### 6.2 cancel_job

```rust
#[tauri::command]
async fn cancel_job(job_id: String) -> Result<(), String>
```

### 6.3 pause_job / resume_job

```rust
#[tauri::command]
async fn pause_job(job_id: String) -> Result<(), String>

#[tauri::command]
async fn resume_job(job_id: String) -> Result<(), String>
```

### 6.4 reorder_jobs

```rust
#[tauri::command]
async fn reorder_jobs(job_ids: Vec<String>) -> Result<(), String>
// Pending 状態のジョブのみ順序変更可能
```

### 6.5 clear_completed_jobs

```rust
#[tauri::command]
async fn clear_completed_jobs() -> Result<u32, String>  // 削除件数
```

---

## 7. プリセット API

### 7.1 get_presets

```rust
#[tauri::command]
async fn get_presets() -> Result<PresetList, String>

struct PresetList {
    builtin: Vec<Preset>,
    user: Vec<Preset>,
}

struct Preset {
    id: String,
    name: String,
    description: String,
    category: PresetCategory,
    is_builtin: bool,
    command: FFmpegCommand,
    created_at: Option<String>,
    updated_at: Option<String>,
}

enum PresetCategory {
    Web,
    Social,
    Archive,
    Audio,
    Custom,
}
```

### 7.2 save_preset

```rust
#[tauri::command]
async fn save_preset(preset: Preset) -> Result<String, String>  // preset_id
```

### 7.3 delete_preset

```rust
#[tauri::command]
async fn delete_preset(preset_id: String) -> Result<(), String>
// ビルトインプリセットは削除不可
```

### 7.4 export_presets / import_presets

```rust
#[tauri::command]
async fn export_presets(path: String) -> Result<(), String>

#[tauri::command]
async fn import_presets(path: String) -> Result<u32, String>  // インポート件数
```

---

## 8. 設定 API

### 8.1 get_settings

```rust
#[tauri::command]
async fn get_settings() -> Result<AppSettings, String>

struct AppSettings {
    output_dir: String,
    duplicate_action: DuplicateAction,
    max_parallel_jobs: u32,
    theme: Theme,
    locale: Locale,
    notifications: bool,
    ffmpeg_path: Option<String>,
    ytdlp_path: Option<String>,
    filename_template: String,
}

enum DuplicateAction {
    Overwrite,
    Rename,
    Skip,
    Ask,
}

enum Theme {
    Dark,
    Light,
    System,
}

enum Locale {
    Ja,
    En,
}
```

### 8.2 update_settings

```rust
#[tauri::command]
async fn update_settings(settings: AppSettings) -> Result<(), String>
```

### 8.3 reset_settings

```rust
#[tauri::command]
async fn reset_settings() -> Result<AppSettings, String>
// デフォルト設定に戻す
```

### 8.4 export_settings / import_settings

```rust
#[tauri::command]
async fn export_settings(path: String) -> Result<(), String>

#[tauri::command]
async fn import_settings(path: String) -> Result<(), String>
```

---

## 9. ストリーミング API

### 9.1 probe_stream
ストリームURLの接続テストとメタ情報取得

```rust
#[tauri::command]
async fn probe_stream(url: String) -> Result<StreamProbeResult, String>

struct StreamProbeResult {
    url: String,
    protocol: String,       // "rtmp", "hls", "dash"
    streams: Vec<StreamInfo>,
    is_live: bool,
}
```

### 9.2 start_recording

```rust
#[tauri::command]
async fn start_recording(
    app: AppHandle,
    url: String,
    output_path: String,
    format: Option<String>,
    duration_limit: Option<f64>,  // 秒。None = 無制限
) -> Result<String, String>  // ジョブID

// Events:
// "recording:progress:{job_id}" → { elapsed: f64, size: u64 }
```

### 9.3 stop_recording

```rust
#[tauri::command]
async fn stop_recording(job_id: String) -> Result<String, String>
// 録画停止 → 出力パスを返す
```

---

## 10. ユーティリティ API

### 10.1 open_file_dialog

```rust
#[tauri::command]
async fn open_file_dialog(
    title: Option<String>,
    filters: Option<Vec<FileFilter>>,
    multiple: bool,
    directory: bool,
) -> Result<Vec<String>, String>

struct FileFilter {
    name: String,        // "動画ファイル"
    extensions: Vec<String>,  // ["mp4", "mkv", "avi"]
}
```

### 10.2 open_save_dialog

```rust
#[tauri::command]
async fn open_save_dialog(
    title: Option<String>,
    default_path: Option<String>,
    filters: Option<Vec<FileFilter>>,
) -> Result<Option<String>, String>
```

### 10.3 open_in_explorer
ファイルマネージャーでフォルダを開く

```rust
#[tauri::command]
async fn open_in_explorer(path: String) -> Result<(), String>
```

### 10.4 get_system_info

```rust
#[tauri::command]
fn get_system_info() -> Result<SystemInfo, String>

struct SystemInfo {
    os: String,              // "windows" | "macos"
    arch: String,            // "x86_64" | "aarch64"
    cpu_cores: u32,
    total_memory: u64,       // バイト
    gpu: Option<String>,     // "NVIDIA GeForce RTX 5090"
}
```

---

## 11. フロントエンド API ラッパー

### commands.ts

```typescript
// src/lib/tauri/commands.ts
// 全Tauriコマンドの型安全なラッパー

import { invoke } from '@tauri-apps/api/core';

// Setup
export const checkBinaries = () => invoke<BinaryStatus>('check_binaries');
export const downloadBinary = (tool: 'ffmpeg' | 'ytdlp') =>
  invoke<string>('download_binary', { tool });
export const checkUpdates = () => invoke<UpdateInfo>('check_updates');

// Media
export const probeMedia = (path: string) =>
  invoke<MediaInfo>('probe_media', { path });
export const generateThumbnails = (path: string, count?: number) =>
  invoke<string[]>('generate_thumbnails', { path, count: count ?? 20, width: 160, height: 90 });
export const generateWaveform = (path: string, samples?: number) =>
  invoke<WaveformData>('generate_waveform', { path, samples: samples ?? 1000 });

// YouTube
export const fetchVideoInfo = (url: string) =>
  invoke<VideoInfo>('fetch_video_info', { url });
export const startDownload = (params: DownloadParams) =>
  invoke<string>('start_download', params);
export const cancelDownload = (jobId: string) =>
  invoke<void>('cancel_download', { jobId });
export const getPreviewUrl = (url: string) =>
  invoke<string>('get_preview_url', { url });

// FFmpeg
export const executeFFmpeg = (command: FFmpegCommand) =>
  invoke<string>('execute_ffmpeg', { command });
export const executeRawCommand = (commandString: string) =>
  invoke<string>('execute_raw_command', { commandString });
export const extractStreams = (params: ExtractParams) =>
  invoke<string>('extract_streams', params);
export const trimMedia = (params: TrimParams) =>
  invoke<string>('trim_media', params);
export const detectHwEncoders = () =>
  invoke<HWEncoder[]>('detect_hw_encoders');
export const buildCommandPreview = (command: FFmpegCommand) =>
  invoke<string>('build_command_preview', { command });
export const estimateOutputSize = (params: EstimateParams) =>
  invoke<number>('estimate_output_size', params);

// Jobs
export const getJobs = () => invoke<Job[]>('get_jobs');
export const cancelJob = (jobId: string) =>
  invoke<void>('cancel_job', { jobId });
export const pauseJob = (jobId: string) =>
  invoke<void>('pause_job', { jobId });
export const resumeJob = (jobId: string) =>
  invoke<void>('resume_job', { jobId });
export const reorderJobs = (jobIds: string[]) =>
  invoke<void>('reorder_jobs', { jobIds });
export const clearCompletedJobs = () =>
  invoke<number>('clear_completed_jobs');

// Presets
export const getPresets = () => invoke<PresetList>('get_presets');
export const savePreset = (preset: Preset) =>
  invoke<string>('save_preset', { preset });
export const deletePreset = (presetId: string) =>
  invoke<void>('delete_preset', { presetId });

// Settings
export const getSettings = () => invoke<AppSettings>('get_settings');
export const updateSettings = (settings: AppSettings) =>
  invoke<void>('update_settings', { settings });
export const resetSettings = () => invoke<AppSettings>('reset_settings');

// Streaming
export const probeStream = (url: string) =>
  invoke<StreamProbeResult>('probe_stream', { url });
export const startRecording = (params: RecordingParams) =>
  invoke<string>('start_recording', params);
export const stopRecording = (jobId: string) =>
  invoke<string>('stop_recording', { jobId });

// Utility
export const openInExplorer = (path: string) =>
  invoke<void>('open_in_explorer', { path });
export const getSystemInfo = () =>
  invoke<SystemInfo>('get_system_info');
```

### events.ts

```typescript
// src/lib/tauri/events.ts
import { listen, emit } from '@tauri-apps/api/event';

// 型付きイベントリスナー
export const onJobProgress = (jobId: string, callback: (progress: JobProgress) => void) =>
  listen<JobProgress>(`job:progress:${jobId}`, (e) => callback(e.payload));

export const onJobComplete = (jobId: string, callback: (result: JobResult) => void) =>
  listen<JobResult>(`job:complete:${jobId}`, (e) => callback(e.payload));

export const onJobError = (jobId: string, callback: (error: JobError) => void) =>
  listen<JobError>(`job:error:${jobId}`, (e) => callback(e.payload));

export const onDownloadProgress = (jobId: string, callback: (progress: DownloadProgress) => void) =>
  listen<DownloadProgress>(`download:progress:${jobId}`, (e) => callback(e.payload));

export const onSetupProgress = (callback: (progress: SetupProgress) => void) =>
  listen<SetupProgress>('setup:download-progress', (e) => callback(e.payload));

export const onQueueUpdated = (callback: (jobs: Job[]) => void) =>
  listen<Job[]>('job:queue-updated', (e) => callback(e.payload));
```
