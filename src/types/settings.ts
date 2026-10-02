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
  realesrganInstalled: boolean;
  realesrganVersion?: string;
  realesrganPath?: string;
  /** yt-dlp が使う JS ランタイム名 ("deno" / "node" / "bun")。未検出なら undefined */
  jsRuntime?: string;
  jsRuntimePath?: string;
  /** インストール済みの追加 AI 超解像モデル ID */
  aiModels: string[];
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
