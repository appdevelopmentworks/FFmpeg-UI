export type FilterParamType = 'number' | 'select' | 'boolean' | 'string' | 'file';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterParam {
  key: string;
  labelKey: string; // i18n key under 'filter' namespace, or raw label if prefixed with '_'
  type: FilterParamType;
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: FilterOption[];
  unit?: string;
}

export interface FilterDefinition {
  id: string;
  nameKey: string; // key in 'filter' i18n namespace
  category: 'video' | 'audio';
  ffmpegFilter: string;
  params: FilterParam[];
  buildArgs: (params: Record<string, number | string | boolean>) => string;
}

export interface AppliedFilter {
  instanceId: string;
  filterId: string;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
}

// ── Filter Definitions ────────────────────────────────────────────────────────

export const FILTER_DEFINITIONS: FilterDefinition[] = [
  // ── Video ──────────────────────────────────────────────────────────────────
  {
    id: 'crop',
    nameKey: 'crop',
    category: 'video',
    ffmpegFilter: 'crop',
    params: [
      { key: 'w', labelKey: '_Width', type: 'number', default: 1280, min: 1, max: 7680, step: 2, unit: 'px' },
      { key: 'h', labelKey: '_Height', type: 'number', default: 720, min: 1, max: 4320, step: 2, unit: 'px' },
      { key: 'x', labelKey: '_X', type: 'number', default: 0, min: 0, max: 7680, step: 1, unit: 'px' },
      { key: 'y', labelKey: '_Y', type: 'number', default: 0, min: 0, max: 4320, step: 1, unit: 'px' },
    ],
    buildArgs: (p) => `crop=${p.w}:${p.h}:${p.x}:${p.y}`,
  },
  {
    id: 'scale',
    nameKey: 'scale',
    category: 'video',
    ffmpegFilter: 'scale',
    params: [
      { key: 'w', labelKey: '_Width', type: 'number', default: 1280, min: -2, max: 7680, step: 2, unit: 'px' },
      { key: 'h', labelKey: '_Height', type: 'number', default: 720, min: -2, max: 4320, step: 2, unit: 'px' },
      {
        key: 'flags', labelKey: '_Algorithm', type: 'select', default: 'lanczos',
        options: [
          { label: 'Lanczos (best)', value: 'lanczos' },
          { label: 'Bicubic', value: 'bicubic' },
          { label: 'Bilinear', value: 'bilinear' },
          { label: 'Fast Bilinear', value: 'fast_bilinear' },
        ],
      },
    ],
    buildArgs: (p) => `scale=${p.w}:${p.h}:flags=${p.flags}`,
  },
  {
    id: 'rotate',
    nameKey: 'rotate',
    category: 'video',
    ffmpegFilter: 'rotate',
    params: [
      {
        key: 'angle', labelKey: '_Angle', type: 'select', default: '90*PI/180',
        options: [
          { label: '90° CW', value: 'PI/2' },
          { label: '180°', value: 'PI' },
          { label: '270° CW', value: '3*PI/2' },
        ],
      },
    ],
    buildArgs: (p) => `rotate=${p.angle}`,
  },
  {
    id: 'hflip',
    nameKey: '_Flip Horizontal',
    category: 'video',
    ffmpegFilter: 'hflip',
    params: [],
    buildArgs: () => 'hflip',
  },
  {
    id: 'vflip',
    nameKey: '_Flip Vertical',
    category: 'video',
    ffmpegFilter: 'vflip',
    params: [],
    buildArgs: () => 'vflip',
  },
  {
    id: 'color',
    nameKey: 'colorCorrection',
    category: 'video',
    ffmpegFilter: 'eq',
    params: [
      { key: 'brightness', labelKey: '_Brightness', type: 'number', default: 0, min: -1, max: 1, step: 0.01 },
      { key: 'contrast', labelKey: '_Contrast', type: 'number', default: 1, min: -1000, max: 1000, step: 0.1 },
      { key: 'saturation', labelKey: '_Saturation', type: 'number', default: 1, min: 0, max: 3, step: 0.05 },
      { key: 'gamma', labelKey: '_Gamma', type: 'number', default: 1, min: 0.1, max: 10, step: 0.1 },
    ],
    buildArgs: (p) =>
      `eq=brightness=${p.brightness}:contrast=${p.contrast}:saturation=${p.saturation}:gamma=${p.gamma}`,
  },
  {
    id: 'blur',
    nameKey: 'blur',
    category: 'video',
    ffmpegFilter: 'boxblur',
    params: [
      { key: 'radius', labelKey: '_Radius', type: 'number', default: 2, min: 1, max: 20, step: 0.5, unit: 'px' },
    ],
    buildArgs: (p) => `boxblur=${p.radius}:1`,
  },
  {
    id: 'sharpen',
    nameKey: '_Sharpen',
    category: 'video',
    ffmpegFilter: 'unsharp',
    params: [
      { key: 'strength', labelKey: '_Strength', type: 'number', default: 1.5, min: 0.1, max: 5, step: 0.1 },
    ],
    buildArgs: (p) => `unsharp=5:5:${p.strength}:5:5:0`,
  },
  {
    id: 'denoise',
    nameKey: 'denoise',
    category: 'video',
    ffmpegFilter: 'hqdn3d',
    params: [
      {
        key: 'preset', labelKey: '_Strength', type: 'select', default: 'medium',
        options: [
          { label: 'Mild', value: 'mild' },
          { label: 'Medium', value: 'medium' },
          { label: 'Strong', value: 'strong' },
        ],
      },
    ],
    buildArgs: (p) => {
      const map: Record<string, string> = { mild: '2:1:2:3', medium: '4:3:6:4.5', strong: '10:7:12:9' };
      return `hqdn3d=${map[String(p.preset)] ?? '4:3:6:4.5'}`;
    },
  },
  {
    id: 'fade',
    nameKey: 'fade',
    category: 'video',
    ffmpegFilter: 'fade',
    params: [
      {
        key: 'type', labelKey: '_Type', type: 'select', default: 'in',
        options: [
          { label: 'Fade In', value: 'in' },
          { label: 'Fade Out', value: 'out' },
        ],
      },
      { key: 'start', labelKey: '_Start (sec)', type: 'number', default: 0, min: 0, max: 3600, step: 0.1, unit: 's' },
      { key: 'duration', labelKey: '_Duration (sec)', type: 'number', default: 1, min: 0.1, max: 10, step: 0.1, unit: 's' },
    ],
    buildArgs: (p) => `fade=t=${p.type}:st=${p.start}:d=${p.duration}`,
  },
  {
    id: 'speed',
    nameKey: 'speed',
    category: 'video',
    ffmpegFilter: 'setpts',
    params: [
      {
        key: 'factor', labelKey: '_Speed', type: 'select', default: '0.5',
        options: [
          { label: '0.25×', value: '4.0' },
          { label: '0.5×', value: '2.0' },
          { label: '1×', value: '1.0' },
          { label: '1.5×', value: '0.667' },
          { label: '2×', value: '0.5' },
          { label: '4×', value: '0.25' },
        ],
      },
    ],
    buildArgs: (p) => `setpts=${p.factor}*PTS`,
  },
  {
    id: 'reverse',
    nameKey: '_Reverse',
    category: 'video',
    ffmpegFilter: 'reverse',
    params: [],
    buildArgs: () => 'reverse',
  },
  {
    id: 'yadif',
    nameKey: '_Deinterlace',
    category: 'video',
    ffmpegFilter: 'yadif',
    params: [
      {
        key: 'mode', labelKey: '_Mode', type: 'select', default: '0',
        options: [
          { label: 'Send Frame', value: '0' },
          { label: 'Send Field', value: '1' },
          { label: 'Send Frame (no spatial)', value: '2' },
          { label: 'Send Field (no spatial)', value: '3' },
        ],
      },
    ],
    buildArgs: (p) => `yadif=mode=${p.mode}`,
  },

  // ── Audio ──────────────────────────────────────────────────────────────────
  {
    id: 'volume',
    nameKey: '_Volume',
    category: 'audio',
    ffmpegFilter: 'volume',
    params: [
      { key: 'level', labelKey: '_Level', type: 'number', default: 1.0, min: 0, max: 10, step: 0.05, unit: '×' },
    ],
    buildArgs: (p) => `volume=${p.level}`,
  },
  {
    id: 'loudnorm',
    nameKey: '_Normalize',
    category: 'audio',
    ffmpegFilter: 'loudnorm',
    params: [
      { key: 'I', labelKey: '_Target LUFS', type: 'number', default: -16, min: -70, max: -5, step: 1, unit: 'LUFS' },
    ],
    buildArgs: (p) => `loudnorm=I=${p.I}:TP=-1.5:LRA=11`,
  },
  {
    id: 'afade',
    nameKey: '_Audio Fade',
    category: 'audio',
    ffmpegFilter: 'afade',
    params: [
      {
        key: 'type', labelKey: '_Type', type: 'select', default: 'in',
        options: [
          { label: 'Fade In', value: 'in' },
          { label: 'Fade Out', value: 'out' },
        ],
      },
      { key: 'start', labelKey: '_Start (sec)', type: 'number', default: 0, min: 0, max: 3600, step: 0.1, unit: 's' },
      { key: 'duration', labelKey: '_Duration (sec)', type: 'number', default: 1, min: 0.1, max: 10, step: 0.1, unit: 's' },
    ],
    buildArgs: (p) => `afade=t=${p.type}:st=${p.start}:d=${p.duration}`,
  },
  {
    id: 'afftdn',
    nameKey: 'denoise',
    category: 'audio',
    ffmpegFilter: 'afftdn',
    params: [
      { key: 'nr', labelKey: '_Noise Reduction', type: 'number', default: 10, min: 1, max: 97, step: 1, unit: 'dB' },
    ],
    buildArgs: (p) => `afftdn=nr=${p.nr}`,
  },
  {
    id: 'atempo',
    nameKey: 'speed',
    category: 'audio',
    ffmpegFilter: 'atempo',
    params: [
      {
        key: 'tempo', labelKey: '_Speed', type: 'select', default: '1.0',
        options: [
          { label: '0.5×', value: '0.5' },
          { label: '0.75×', value: '0.75' },
          { label: '1×', value: '1.0' },
          { label: '1.25×', value: '1.25' },
          { label: '1.5×', value: '1.5' },
          { label: '2×', value: '2.0' },
        ],
      },
    ],
    buildArgs: (p) => `atempo=${p.tempo}`,
  },
  {
    id: 'channelmix',
    nameKey: '_Channel Mix',
    category: 'audio',
    ffmpegFilter: 'pan',
    params: [
      {
        key: 'layout', labelKey: '_Layout', type: 'select', default: 'stereo',
        options: [
          { label: 'Stereo', value: 'stereo' },
          { label: 'Mono', value: 'mono' },
        ],
      },
    ],
    buildArgs: (p) =>
      p.layout === 'mono'
        ? 'pan=mono|c0=0.5*c0+0.5*c1'
        : 'pan=stereo|c0=c0|c1=c1',
  },
];

export const VIDEO_FILTERS = FILTER_DEFINITIONS.filter((f) => f.category === 'video');
export const AUDIO_FILTERS = FILTER_DEFINITIONS.filter((f) => f.category === 'audio');

export function getFilterById(id: string): FilterDefinition | undefined {
  return FILTER_DEFINITIONS.find((f) => f.id === id);
}

export function buildFilterChain(applied: AppliedFilter[]): string {
  return applied
    .filter((a) => a.enabled)
    .map((a) => {
      const def = getFilterById(a.filterId);
      return def ? def.buildArgs(a.params) : null;
    })
    .filter(Boolean)
    .join(',');
}
