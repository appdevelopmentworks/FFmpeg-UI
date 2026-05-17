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
  algorithm?: ScalingAlgorithm;
  aiModel?: AiUpscaleModel;
  aiScale?: 2 | 3 | 4;
}

export type ScalingAlgorithm = 'bilinear' | 'lanczos' | 'ai';

export type AiUpscaleModel =
  | 'realesr-animevideov3'
  | 'realesrgan-x4plus'
  | 'realesrgan-x4plus-anime';

export interface TrimSpec {
  start: number; // 秒
  end: number; // 秒
  accurate: boolean; // true=再エンコード, false=copy
}

/** フィルター定義 */
export interface FilterSpec {
  id: string; // UUID
  name: string; // FFmpegフィルター名
  displayName: string; // UI表示名（i18n キー）
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
  preview: boolean; // プレビュー対応か
}

export interface FilterParamDefinition {
  key: string;
  label: string; // i18n キー
  type: 'number' | 'string' | 'select' | 'boolean' | 'range' | 'file';
  default: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  unit?: string; // "px", "dB", "%", "x"
}

export type EncoderPreset =
  | 'ultrafast'
  | 'superfast'
  | 'veryfast'
  | 'faster'
  | 'fast'
  | 'medium'
  | 'slow'
  | 'slower'
  | 'veryslow';

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
  name: string; // "H.264", "H.265/HEVC"
  ffmpegName: string; // "libx264", "libx265"
  type: 'video' | 'audio';
  hwVariants?: string[]; // ["h264_nvenc", "h264_qsv"]
}

/** コンテナフォーマット選択肢 */
export interface ContainerOption {
  id: string;
  name: string; // "MP4"
  extension: string; // "mp4"
  supportedVideoCodecs: string[];
  supportedAudioCodecs: string[];
}
