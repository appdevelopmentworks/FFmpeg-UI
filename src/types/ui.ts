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
  labelKey: string; // i18n キー
  icon: string; // Lucide icon 名
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
  streams: import('./media').StreamInfo[];
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
