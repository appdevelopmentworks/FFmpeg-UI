# FFmpeg-UI アーキテクチャ設計書

> **ドキュメント番号**: 02
> **作成日**: 2026-03-25
> **バージョン**: 1.0

---

## 1. システム全体像

```
┌─────────────────────────────────────────────────────────────────┐
│                        FFmpeg-UI Application                    │
├─────────────────────┬───────────────────────────────────────────┤
│   Frontend Layer    │           Backend Layer (Rust)            │
│   (WebView)         │           (Tauri Core)                    │
│                     │                                           │
│  ┌───────────────┐  │  ┌─────────────────────────────────────┐  │
│  │  Next.js 15   │  │  │         Tauri Commands              │  │
│  │  App Router   │◄─┼─►│  (invoke / listen / emit)           │  │
│  │  (SSG)        │  │  └──────────┬──────────────────────────┘  │
│  └───────┬───────┘  │             │                             │
│          │          │  ┌──────────▼──────────────────────────┐  │
│  ┌───────▼───────┐  │  │        Service Layer                │  │
│  │  React 19     │  │  │  ┌───────────┐  ┌───────────────┐  │  │
│  │  Components   │  │  │  │  FFmpeg   │  │    yt-dlp     │  │  │
│  │  + Zustand    │  │  │  │  Service  │  │   Service     │  │  │
│  │  + Framer     │  │  │  └─────┬─────┘  └──────┬────────┘  │  │
│  └───────────────┘  │  │       │                │            │  │
│                     │  │  ┌────▼────────────────▼─────────┐  │  │
│                     │  │  │     Process Manager            │  │  │
│                     │  │  │  (Tokio async runtime)         │  │  │
│                     │  │  └────┬────────────────┬─────────┘  │  │
│                     │  └───────┼────────────────┼────────────┘  │
│                     │          │                │               │
├─────────────────────┼──────────┼────────────────┼───────────────┤
│   OS Layer          │          ▼                ▼               │
│                     │    ┌──────────┐    ┌──────────┐          │
│                     │    │  ffmpeg  │    │  yt-dlp  │          │
│                     │    │  binary  │    │  binary  │          │
│                     │    └──────────┘    └──────────┘          │
│                     │                                           │
│                     │    ┌──────────────────────────┐          │
│                     │    │  File System             │          │
│                     │    │  (入出力ファイル/設定)     │          │
│                     │    └──────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. レイヤーアーキテクチャ

### 2.1 フロントエンドレイヤー

```
Frontend Architecture
=====================

Presentation Layer (React Components)
├── Layout Components
│   ├── Header (テーマ/言語切替)
│   ├── TabBar (タブナビゲーション)
│   └── JobQueueFooter (ジョブキュー)
├── Tab Components (8タブ)
│   ├── YouTubeTab
│   ├── ConvertTab
│   ├── TrimTab
│   ├── ExtractTab
│   ├── FilterTab
│   ├── BatchTab
│   ├── StreamTab
│   └── CommandTab
└── Shared Components
    ├── FileDropZone
    ├── MediaPlayer
    ├── Timeline
    ├── ProgressBar
    └── PresetSelector

State Layer (Zustand Stores)
├── jobStore        → ジョブキュー状態
├── settingsStore   → アプリ設定
├── presetStore     → プリセット管理
├── mediaStore      → 読み込み済みメディア情報
└── uiStore         → UIの一時状態(タブ選択等)

Service Layer (Tauri Bridge)
├── tauriCommands.ts  → invoke() ラッパー
├── tauriEvents.ts    → listen() / emit() ラッパー
└── tauriBridge.ts    → 型安全なAPI統合

Utility Layer
├── commandBuilder.ts → FFmpegコマンド文字列生成
├── presets.ts        → ビルトインプリセット定義
├── filters.ts        → フィルター定義カタログ
├── i18n/             → 翻訳ファイル
└── validators.ts     → 入力バリデーション
```

### 2.2 バックエンドレイヤー (Rust)

```
Backend Architecture (src-tauri/src/)
======================================

Commands Layer (Tauri IPC エントリポイント)
├── commands/
│   ├── ffmpeg.rs     → FFmpeg操作コマンド
│   ├── ytdlp.rs      → yt-dlp操作コマンド
│   ├── setup.rs       → セットアップ・バイナリ管理
│   ├── jobs.rs        → ジョブキュー操作
│   ├── settings.rs    → 設定読み書き
│   └── presets.rs     → プリセット管理

Service Layer (ビジネスロジック)
├── services/
│   ├── ffmpeg_service.rs    → FFmpegコマンド実行・出力パース
│   ├── ytdlp_service.rs     → yt-dlp実行・メタデータパース
│   ├── job_queue.rs          → ジョブキュー管理(FIFO + 優先度)
│   ├── binary_manager.rs     → バイナリDL/更新/パス管理
│   ├── process_manager.rs    → 外部プロセス実行・監視
│   └── preset_manager.rs     → プリセットCRUD

Model Layer (データ構造)
├── models/
│   ├── media.rs       → MediaInfo, Stream, Format
│   ├── job.rs         → Job, JobStatus, JobProgress
│   ├── ffmpeg.rs      → FFmpegCommand, Filter, Codec
│   ├── ytdlp.rs       → VideoInfo, DownloadFormat
│   ├── preset.rs      → Preset, PresetCategory
│   └── settings.rs    → AppSettings

Infrastructure Layer
├── error.rs           → 統一エラー型
├── config.rs          → アプリ設定パス解決
└── platform.rs        → OS固有処理の抽象化
```

---

## 3. データフロー

### 3.1 YouTubeダウンロードフロー

```
[ユーザー]
    │ URLペースト
    ▼
[YouTubeTab] ──invoke──► [ytdlp.rs:fetch_video_info]
                              │
                              ▼
                         [ytdlp_service.rs]
                              │ yt-dlp --dump-json <URL>
                              ▼
                         [yt-dlp binary] ──► YouTube API
                              │
                              ▼ JSON パース
                         VideoInfo { title, formats, thumbnail, ... }
                              │
    ◄──── Result<VideoInfo> ──┘
    │
    ▼ フォーマット選択 → ダウンロード開始
[YouTubeTab] ──invoke──► [ytdlp.rs:start_download]
                              │
                              ▼
                         [ytdlp_service.rs]
                              │ yt-dlp -f <format> -o <path> <URL>
                              │
                              │── emit("download:progress") ──►[JobQueueFooter]
                              │── emit("download:progress") ──►  (進捗更新)
                              │── emit("download:progress") ──►
                              │
                              ▼ 完了
                         emit("download:complete")
```

### 3.2 FFmpeg処理フロー

```
[ユーザー]
    │ ファイル入力 + 設定選択
    ▼
[ConvertTab/TrimTab/...] ──invoke──► [ffmpeg.rs:execute_command]
                                          │
                                          ▼
                                     [job_queue.rs]
                                          │ ジョブ登録・キュー管理
                                          ▼
                                     [ffmpeg_service.rs]
                                          │ FFmpegコマンド構築
                                          │ ffmpeg -i input [options] output
                                          ▼
                                     [process_manager.rs]
                                          │ tokio::process::Command
                                          │ stderr リアルタイム読取
                                          │
                                          │── パース: "time=00:01:23.45"
                                          │── 進捗率計算: current / duration
                                          │── emit("job:progress", { id, percent, speed, eta })
                                          │
                                          ▼ 完了 or エラー
                                     emit("job:complete" / "job:error")
```

### 3.3 ジョブキューフロー

```
┌──────────────────────────────────────────────────────────┐
│                    JobQueue (Rust側)                      │
│                                                          │
│  Queue: [Job1(running)] [Job2(pending)] [Job3(pending)]  │
│                                                          │
│  ┌─────────────┐                                         │
│  │ Worker Pool │  max_workers = CPU cores (設定可能)      │
│  │  Worker 1 ──┼──► ffmpeg process (Job1)                │
│  │  Worker 2 ──┼──► (idle, waiting for Job2)             │
│  └─────────────┘                                         │
│                                                          │
│  Operations:                                             │
│  ├── enqueue(job)      → キューに追加                     │
│  ├── cancel(job_id)    → プロセスkill + 一時ファイル削除  │
│  ├── pause(job_id)     → SIGSTOP (Windows: SuspendThread)│
│  ├── resume(job_id)    → SIGCONT (Windows: ResumeThread) │
│  ├── reorder(job_ids)  → キュー順序変更                   │
│  └── get_status()      → 全ジョブの状態返却               │
└──────────────────────────────────────────────────────────┘
```

---

## 4. 通信アーキテクチャ

### 4.1 Tauri IPC パターン

```typescript
// Pattern 1: Request-Response (同期的な操作)
// Frontend → Backend → Frontend
const info = await invoke<MediaInfo>('probe_media', { path: filePath });

// Pattern 2: Command + Event Stream (長時間操作)
// Frontend → Backend (invoke) → Frontend (listen で進捗受信)
const jobId = await invoke<string>('start_download', { url, format, output });
const unlisten = await listen<JobProgress>(`job:progress:${jobId}`, (event) => {
  updateProgress(event.payload);
});

// Pattern 3: Frontend → Backend Event (UIからの通知)
await emit('job:cancel', { jobId });
```

### 4.2 イベント命名規則

```
Namespace         | Event Name              | Payload
──────────────────┼─────────────────────────┼─────────────────────
setup:            | setup:check-result      | { ffmpeg: bool, ytdlp: bool }
                  | setup:download-progress | { tool: string, percent: number }
                  | setup:download-complete | { tool: string, version: string }
                  | setup:download-error    | { tool: string, error: string }
──────────────────┼─────────────────────────┼─────────────────────
job:              | job:progress:{id}       | { percent, speed, eta, currentTime }
                  | job:complete:{id}       | { outputPath, duration }
                  | job:error:{id}          | { message, stderr }
                  | job:queue-updated       | Job[]
──────────────────┼─────────────────────────┼─────────────────────
download:         | download:progress:{id}  | { percent, speed, eta, fileSize }
                  | download:complete:{id}  | { outputPath, fileSize }
                  | download:error:{id}     | { message }
```

---

## 5. 状態管理設計

### 5.1 Zustand ストア構成

```typescript
// jobStore.ts - ジョブキュー状態
interface JobStore {
  jobs: Job[];
  activeJobCount: number;
  addJob: (job: Job) => void;
  updateJobProgress: (id: string, progress: JobProgress) => void;
  removeJob: (id: string) => void;
  cancelJob: (id: string) => Promise<void>;
  pauseJob: (id: string) => Promise<void>;
  resumeJob: (id: string) => Promise<void>;
  reorderJobs: (ids: string[]) => Promise<void>;
}

// settingsStore.ts - アプリ設定（tauri-plugin-store で永続化）
interface SettingsStore {
  outputDir: string;
  duplicateAction: 'overwrite' | 'rename' | 'skip' | 'ask';
  maxParallelJobs: number;
  theme: 'dark' | 'light' | 'system';
  locale: 'ja' | 'en';
  notifications: boolean;
  ffmpegPath: string | null;
  ytdlpPath: string | null;
  load: () => Promise<void>;
  save: () => Promise<void>;
  update: (partial: Partial<SettingsStore>) => void;
}

// presetStore.ts - プリセット管理
interface PresetStore {
  builtinPresets: Preset[];
  userPresets: Preset[];
  addPreset: (preset: Preset) => void;
  updatePreset: (id: string, preset: Partial<Preset>) => void;
  deletePreset: (id: string) => void;
  importPresets: (json: string) => void;
  exportPresets: () => string;
}

// mediaStore.ts - 現在読み込み中のメディア
interface MediaStore {
  currentMedia: MediaInfo | null;
  videoInfo: VideoInfo | null;    // YouTube用
  streams: StreamInfo[];
  setMedia: (info: MediaInfo) => void;
  setVideoInfo: (info: VideoInfo) => void;
  clear: () => void;
}

// uiStore.ts - UI状態
interface UIStore {
  activeTab: TabId;
  jobQueueExpanded: boolean;
  setupDialogOpen: boolean;
  setActiveTab: (tab: TabId) => void;
  toggleJobQueue: () => void;
}
```

---

## 6. セキュリティ設計

### 6.1 Tauri許可設定 (capabilities)

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "description": "Default capabilities for FFmpeg-UI",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-execute",
    "shell:allow-spawn",
    "shell:allow-stdin-write",
    "shell:allow-kill",
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-message",
    "fs:allow-read",
    "fs:allow-write",
    "fs:allow-exists",
    "fs:allow-mkdir",
    "fs:allow-remove",
    "fs:allow-rename",
    "store:allow-get",
    "store:allow-set",
    "store:allow-delete",
    "store:allow-keys",
    "store:allow-values",
    "store:allow-entries",
    "store:allow-length",
    "store:allow-load",
    "store:allow-save",
    "store:allow-clear"
  ]
}
```

### 6.2 セキュリティ原則
- FFmpeg/yt-dlp バイナリはGitHub Releasesからのみダウンロード
- ダウンロード後のSHA256チェックサム検証
- 外部通信はyt-dlpのダウンロード処理のみ
- ユーザー設定・プリセットはローカルファイルのみ（テレメトリなし）
- 入力パスのサニタイズ（パストラバーサル防止）
- コマンドインジェクション防止（引数は配列で渡す、シェル経由しない）

---

## 7. エラーハンドリング戦略

### 7.1 Rust側 統一エラー型

```rust
// src-tauri/src/error.rs
#[derive(Debug, thiserror::Error)]
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

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

// Tauriコマンドの戻り値に使用
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        serializer.serialize_str(&self.to_string())
    }
}
```

### 7.2 フロントエンド側

```typescript
// エラーの分類と対応
type ErrorCategory =
  | 'network'       // リトライ可能
  | 'binary'        // セットアップダイアログ表示
  | 'input'         // ユーザーに修正を促す
  | 'ffmpeg'        // FFmpegエラー詳細表示
  | 'permission'    // ファイルアクセス権限
  | 'unknown';      // フォールバック

// トースト通知でエラー表示
// 詳細はジョブキューのログに記録
```

---

## 8. パフォーマンス設計

### 8.1 非同期処理

```
FFmpeg処理の非同期実行フロー
─────────────────────────────

Main Thread (UI)
│
├── invoke("execute_ffmpeg") ──► Tauri Runtime Thread
│                                    │
│   (UIは応答可能)                    ├──► tokio::spawn(async {
│                                    │       process_manager.run(cmd)
│   ◄── listen("job:progress") ◄─────┤       ├── stderr.read_line()
│   ◄── listen("job:progress") ◄─────┤       ├── parse_progress()
│   ◄── listen("job:progress") ◄─────┤       └── emit("job:progress")
│                                    │   })
│   ◄── listen("job:complete") ◄─────┘
│
└── 次のジョブ開始 or UI更新
```

### 8.2 メモリ最適化
- サムネイルストリップ: WebP圧縮、必要分のみ生成（仮想スクロール）
- 波形データ: ダウンサンプリングして表示（1px = N サンプル）
- 大きなメディアファイル: ストリーミング読み込み、メタデータのみメモリ保持
- ジョブ完了後のプロセスリソース即時解放

### 8.3 起動時間最適化
- Tauri + Next.js SSG: WebView起動 + 静的HTML読み込み（高速）
- バイナリチェック: 非同期実行（UIブロックしない）
- 設定読み込み: tauri-plugin-store（ネイティブ速度）
- プリセット: ビルトインはハードコード、ユーザー定義のみファイル読み込み

---

## 9. クロスプラットフォーム対応

### 9.1 OS固有処理の抽象化

```rust
// src-tauri/src/platform.rs

pub trait PlatformOps {
    fn ffmpeg_binary_name() -> &'static str;
    fn ytdlp_binary_name() -> &'static str;
    fn ffmpeg_download_url(version: &str) -> String;
    fn ytdlp_download_url(version: &str) -> String;
    fn set_executable_permission(path: &Path) -> Result<()>;
    fn app_data_dir() -> PathBuf;
    fn suspend_process(pid: u32) -> Result<()>;
    fn resume_process(pid: u32) -> Result<()>;
}

pub struct WindowsPlatform;
pub struct MacOSPlatform;

// コンパイル時にOS判定
#[cfg(target_os = "windows")]
pub type CurrentPlatform = WindowsPlatform;
#[cfg(target_os = "macos")]
pub type CurrentPlatform = MacOSPlatform;
```

### 9.2 OS別の考慮事項

| 項目 | Windows | macOS |
|------|---------|-------|
| バイナリ拡張子 | .exe | なし |
| パス区切り | `\` | `/` |
| 実行権限 | 不要 | chmod +x 必要 |
| プロセス一時停止 | SuspendThread API | SIGSTOP |
| HWエンコード | NVENC / QSV | VideoToolbox |
| アプリデータ | %APPDATA%/ffmpeg-ui | ~/Library/Application Support/ffmpeg-ui |
| 通知 | Windows Notification | NSUserNotification |
| コード署名 | オプション | 必要（GateKeeper） |

---

## 10. ビルド・配布

### 10.1 ビルド設定

```json
// src-tauri/tauri.conf.json (抜粋)
{
  "productName": "FFmpeg-UI",
  "version": "0.1.0",
  "identifier": "com.ffmpeg-ui.app",
  "build": {
    "frontendDist": "../out"
  },
  "app": {
    "windows": [
      {
        "title": "FFmpeg-UI",
        "width": 1280,
        "height": 800,
        "minWidth": 1024,
        "minHeight": 768,
        "resizable": true,
        "decorations": true
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "dmg"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

### 10.2 CI/CD パイプライン

```
GitHub Actions Workflow
───────────────────────

push to main / tag
    │
    ├──► [Build Windows]
    │     ├── Setup Rust + Node.js
    │     ├── npm install
    │     ├── npm run build (Next.js SSG)
    │     └── cargo tauri build --target x86_64-pc-windows-msvc
    │          └── Output: FFmpeg-UI_x.x.x_x64-setup.exe (NSIS)
    │
    └──► [Build macOS]
          ├── Setup Rust + Node.js
          ├── npm install
          ├── npm run build
          └── cargo tauri build --target aarch64-apple-darwin
               └── Output: FFmpeg-UI_x.x.x_aarch64.dmg
```
