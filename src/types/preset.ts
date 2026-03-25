import type { FFmpegCommand } from './ffmpeg';

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
