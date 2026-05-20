'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  RefreshCw,
  Copy,
  ChevronDown,
  CheckCircle,
  Cpu,
} from 'lucide-react';
import { DropZone } from '@/components/ui/DropZone';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Toggle } from '@/components/ui/Toggle';
import { PresetSelector } from '@/components/shared/PresetSelector';
import { useSettingsStore } from '@/stores/settingsStore';
import type { MediaInfo } from '@/types/media';
import type { FFmpegCommand, HWEncoder, ScalingAlgorithm, AiUpscaleModel } from '@/types/ffmpeg';
import type { Preset } from '@/types/preset';
import {
  buildCommandString,
  estimateSize,
  formatFileSize,
} from '@/lib/ffmpeg/commandBuilder';
import {
  VIDEO_CODECS,
  AUDIO_CODECS,
  CONTAINERS,
  RESOLUTION_PRESETS,
  FPS_OPTIONS,
} from '@/lib/ffmpeg/presets';

// ── State ──────────────────────────────────────────────────────────────────────

interface ConvertState {
  inputPath: string;
  inputInfo: MediaInfo | null;
  // Settings
  container: string;
  videoCodec: string;
  audioCodec: string;
  resolutionPreset: string;
  customWidth: number;
  customHeight: number;
  scalingAlgorithm: ScalingAlgorithm;
  aiModel: AiUpscaleModel;
  aiScale: 2 | 3 | 4;
  bitrateMode: 'crf' | 'cbr' | 'vbr';
  crfValue: number;
  videoBitrate: string;
  audioBitrate: string;
  fps: number | null;
  hwEncoder: string;
  twoPass: boolean;
  outputDir: string;
  outputFilename: string;
}

const INITIAL_STATE: ConvertState = {
  inputPath: '',
  inputInfo: null,
  container: 'mp4',
  videoCodec: 'libx264',
  audioCodec: 'aac',
  resolutionPreset: 'original',
  customWidth: 1920,
  customHeight: 1080,
  scalingAlgorithm: 'bilinear',
  aiModel: 'realesrgan-x4plus',
  aiScale: 2,
  bitrateMode: 'crf',
  crfValue: 23,
  videoBitrate: '2000k',
  audioBitrate: '192k',
  fps: null,
  hwEncoder: 'none',
  twoPass: false,
  outputDir: '',
  outputFilename: 'output.mp4',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function joinPath(dir: string, file: string): string {
  if (!dir) return file;
  const sep = dir.includes('\\') ? '\\' : '/';
  const trimmed = dir.replace(/[\\/]+$/, '');
  return `${trimmed}${sep}${file}`;
}

function aiModelShort(m: AiUpscaleModel): string {
  switch (m) {
    case 'realesrgan-x4plus': return 'x4plus';
    case 'realesrgan-x4plus-anime': return 'x4anime';
    case 'realesr-animevideov3': return 'animev3';
  }
}

/** スケーリング設定からファイル名末尾サフィックスを返す */
function scalingSuffix(
  scaling: ScalingAlgorithm,
  resolutionPreset: string,
  aiModel: AiUpscaleModel,
  aiScale: 2 | 3 | 4,
): string {
  if (resolutionPreset === 'original') return 'converted';
  if (scaling === 'ai') return `ai_${aiModelShort(aiModel)}_${aiScale}x`;
  return scaling; // 'bilinear' or 'lanczos'
}

/** 自動生成された outputFilename かを判定するパターン (ユーザー手動編集を尊重するため) */
const AUTO_FILENAME_RE = /_(converted|bilinear|lanczos|ai_[a-z0-9]+_[234]x)\.[^.]+$/i;

function buildAutoFilename(inputPath: string, suffix: string, container: string): string {
  const base = inputPath.split(/[/\\]/).pop() ?? '';
  const stem = base.replace(/\.[^/.]+$/, '');
  return `${stem}_${suffix}.${container}`;
}

function stateToFFmpegCommand(s: ConvertState, fallbackOutputDir: string): FFmpegCommand {
  const isVideoCopy = s.videoCodec === 'copy';
  const isAudioCopy = s.audioCodec === 'copy';

  const effectiveVideoCodec =
    s.hwEncoder !== 'none' ? s.hwEncoder : isVideoCopy ? undefined : s.videoCodec;

  const resolution = (() => {
    if (s.resolutionPreset === 'original') return undefined;
    const base = (() => {
      if (s.resolutionPreset === 'custom') {
        return { width: s.customWidth, height: s.customHeight };
      }
      const preset = RESOLUTION_PRESETS.find((r) => r.id === s.resolutionPreset);
      if (preset && preset.width && preset.height) {
        return { width: preset.width, height: preset.height };
      }
      return undefined;
    })();
    if (!base) return undefined;
    return {
      ...base,
      algorithm: s.scalingAlgorithm,
      ...(s.scalingAlgorithm === 'ai'
        ? { aiModel: s.aiModel, aiScale: s.aiScale }
        : {}),
    };
  })();

  const effectiveOutputDir = s.outputDir || fallbackOutputDir;
  return {
    inputPath: s.inputPath || 'input.mp4',
    outputPath: s.outputFilename
      ? joinPath(effectiveOutputDir, s.outputFilename)
      : joinPath(effectiveOutputDir, 'output.mp4'),
    videoCodec: effectiveVideoCodec,
    audioCodec: isAudioCopy ? undefined : s.audioCodec || undefined,
    videoBitrate:
      s.bitrateMode !== 'crf' && !isVideoCopy ? s.videoBitrate : undefined,
    audioBitrate: !isAudioCopy && s.audioBitrate ? s.audioBitrate : undefined,
    resolution,
    fps: s.fps ?? undefined,
    crf: s.bitrateMode === 'crf' && !isVideoCopy ? s.crfValue : undefined,
    preset: undefined,
    hwAccel: null,
    filters: [],
    extraArgs: [],
    twoPass: s.twoPass && !isVideoCopy,
    container: s.container,
    copyVideo: isVideoCopy,
    copyAudio: isAudioCopy,
    noVideo: false,
    noAudio: false,
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ConvertTab() {
  const t = useTranslations('convert');
  const tc = useTranslations('common');

  const [state, setState] = useState<ConvertState>(INITIAL_STATE);
  const [hwEncoders, setHwEncoders] = useState<HWEncoder[]>([]);
  const [showPresets, setShowPresets] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 設定（デフォルト出力先）— 未ロードならロード
  const settingsOutputDir = useSettingsStore((s) => s.outputDir);
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const loadSettings = useSettingsStore((s) => s.load);
  useEffect(() => {
    if (!settingsLoaded) loadSettings();
  }, [settingsLoaded, loadSettings]);

  const update = useCallback(<K extends keyof ConvertState>(k: K, v: ConvertState[K]) => {
    setState((prev) => ({ ...prev, [k]: v }));
  }, []);

  // Detect HW encoders on mount
  useEffect(() => {
    (async () => {
      try {
        const { detectHwEncoders } = await import('@/lib/tauri/commands');
        const encoders = await detectHwEncoders();
        setHwEncoders(encoders);
      } catch {
        // Not in Tauri context
      }
    })();
  }, []);

  // Build command + estimate size
  const ffmpegCmd = useMemo(
    () => stateToFFmpegCommand(state, settingsOutputDir),
    [state, settingsOutputDir],
  );
  const commandPreview = useMemo(() => buildCommandString(ffmpegCmd), [ffmpegCmd]);

  const estimatedBytes = useMemo(() => {
    const duration = state.inputInfo?.duration ?? 0;
    if (duration <= 0) return 0;
    const vbps =
      state.bitrateMode === 'crf'
        ? undefined
        : parseInt(state.videoBitrate) * 1000;
    const abps = parseInt(state.audioBitrate) * 1000;
    return estimateSize(duration, vbps, abps, ffmpegCmd.crf, ffmpegCmd.videoCodec);
  }, [state, ffmpegCmd]);

  // Handle file drop (Tauri: フルパス配列)
  const handleFileDrop = useCallback(async (paths: string[]) => {
    const filePath = paths[0];
    if (!filePath) return;
    setError(null);

    setState((prev) => {
      const suffix = scalingSuffix(
        prev.scalingAlgorithm,
        prev.resolutionPreset,
        prev.aiModel,
        prev.aiScale,
      );
      return {
        ...prev,
        inputPath: filePath,
        inputInfo: null,
        outputFilename: buildAutoFilename(filePath, suffix, prev.container),
      };
    });

    try {
      const { probeMedia } = await import('@/lib/tauri/commands');
      const info = await probeMedia(filePath);
      setState((prev) => ({ ...prev, inputInfo: info }));
    } catch {
      // Not in Tauri / file unavailable — ignore
    }
  }, []);

  // Apply preset
  const handlePresetSelect = useCallback((preset: Preset) => {
    const cmd = preset.command;
    setState((prev) => ({
      ...prev,
      videoCodec: cmd.videoCodec ?? prev.videoCodec,
      audioCodec: cmd.audioCodec ?? prev.audioCodec,
      container: cmd.container ?? prev.container,
      crfValue: cmd.crf ?? prev.crfValue,
      bitrateMode: cmd.crf !== undefined ? 'crf' : prev.bitrateMode,
      videoBitrate: cmd.videoBitrate ?? prev.videoBitrate,
      audioBitrate: cmd.audioBitrate ?? prev.audioBitrate,
      resolutionPreset: cmd.resolution
        ? 'custom'
        : 'original',
      customWidth: cmd.resolution?.width ?? prev.customWidth,
      customHeight: cmd.resolution?.height ?? prev.customHeight,
      fps: cmd.fps ?? prev.fps,
      twoPass: cmd.twoPass,
      outputFilename: prev.inputPath
        ? buildAutoFilename(
            prev.inputPath,
            scalingSuffix(
              prev.scalingAlgorithm,
              cmd.resolution ? 'custom' : 'original',
              prev.aiModel,
              prev.aiScale,
            ),
            cmd.container ?? prev.container,
          )
        : prev.outputFilename,
    }));
    setShowPresets(false);
  }, []);

  // Copy command to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(commandPreview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [commandPreview]);

  // Execute conversion
  const handleConvert = useCallback(async () => {
    if (!state.inputPath) return;
    setError(null);
    setIsConverting(true);
    try {
      const isAi =
        state.scalingAlgorithm === 'ai' &&
        state.resolutionPreset !== 'original' &&
        !!ffmpegCmd.resolution;
      if (isAi && ffmpegCmd.resolution) {
        const { executeAiUpscale, checkBinaries } = await import('@/lib/tauri/commands');
        const status = await checkBinaries();
        if (!status.realesrganInstalled) {
          setError(t('aiNotInstalled'));
          return;
        }
        await executeAiUpscale({
          inputPath: ffmpegCmd.inputPath,
          outputPath: ffmpegCmd.outputPath,
          model: state.aiModel,
          scale: state.aiScale,
          targetWidth: ffmpegCmd.resolution.width,
          targetHeight: ffmpegCmd.resolution.height,
          videoCodec: ffmpegCmd.videoCodec ?? 'libx264',
          crf: ffmpegCmd.crf,
        });
      } else {
        const { executeFFmpeg } = await import('@/lib/tauri/commands');
        await executeFFmpeg(ffmpegCmd);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsConverting(false);
    }
  }, [state.inputPath, state.scalingAlgorithm, state.resolutionPreset, state.aiModel, state.aiScale, ffmpegCmd, t]);

  // Open output dir dialog
  const handleSelectOutputDir = useCallback(async () => {
    try {
      const { openFileDialog } = await import('@/lib/tauri/commands');
      const dirs = await openFileDialog(tc('outputDir'), [], false, true);
      if (dirs.length > 0) update('outputDir', dirs[0]);
    } catch {
      // ignore
    }
  }, [tc, update]);

  // Sync output extension when container changes
  useEffect(() => {
    setState((prev) => {
      const stem = prev.outputFilename.replace(/\.[^/.]+$/, '');
      return { ...prev, outputFilename: `${stem}.${prev.container}` };
    });
  }, [state.container]);

  // スケーリング設定変更時、自動生成ファイル名のサフィックスを更新する
  // （ユーザーが手動編集した名前は AUTO_FILENAME_RE にマッチしないため温存される）
  useEffect(() => {
    setState((prev) => {
      if (!prev.inputPath) return prev;
      if (!AUTO_FILENAME_RE.test(prev.outputFilename)) return prev;
      const suffix = scalingSuffix(
        prev.scalingAlgorithm,
        prev.resolutionPreset,
        prev.aiModel,
        prev.aiScale,
      );
      const next = buildAutoFilename(prev.inputPath, suffix, prev.container);
      return next === prev.outputFilename ? prev : { ...prev, outputFilename: next };
    });
  }, [
    state.scalingAlgorithm,
    state.aiModel,
    state.aiScale,
    state.resolutionPreset,
  ]);

  // HW encoder options
  const hwOptions = useMemo(() => {
    const baseCodecHw: Record<string, string> = {
      libx264: 'h264',
      libx265: 'hevc',
      'libvpx-vp9': 'vp9',
      'libaom-av1': 'av1',
    };
    const codec = baseCodecHw[state.videoCodec] ?? '';
    const matching = hwEncoders.filter(
      (e) => e.available && (codec === '' || e.codec === codec || e.codec === 'hevc' && codec === 'h265'),
    );
    return [
      { value: 'none', label: t('hwAutoDetect') },
      ...matching.map((e) => ({ value: e.name, label: `${e.name} (${e.device})` })),
    ];
  }, [hwEncoders, state.videoCodec, t]);

  const videoStream = state.inputInfo?.streams.find((s) => s.streamType === 'video');
  const audioStream = state.inputInfo?.streams.find((s) => s.streamType === 'audio');

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      {/* ── DropZone ─────────────────────────────────────────────────────── */}
      {!state.inputPath ? (
        <DropZone
          onFileDrop={handleFileDrop}
          accept={['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.ts', '.m4v']}
          multiple={false}
          label={t('dropzone')}
          sublabel={t('supportedFormats')}
        />
      ) : (
        /* ── Input file info ───────────────────────────────────────────── */
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '0.5px solid var(--border-default)',
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('inputInfo')}
            </span>
            <button
              onClick={() =>
                setState((prev) => ({
                  ...INITIAL_STATE,
                  outputDir: prev.outputDir,
                }))
              }
              className="text-xs"
              style={{ color: 'var(--text-tertiary)' }}
            >
              ✕ {tc('close')}
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {state.inputPath.split(/[/\\]/).pop()}
            </p>
            {state.inputInfo ? (
              <div
                className="mt-2 grid grid-cols-3 gap-2 rounded-lg p-3 text-xs"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>{t('container')}: </span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {state.inputInfo.format.name.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>{tc('size')}: </span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {formatFileSize(state.inputInfo.size)}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>{t('infoDuration')}: </span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {formatDuration(state.inputInfo.duration)}
                  </span>
                </div>
                {videoStream && (
                  <div className="col-span-2">
                    <span style={{ color: 'var(--text-tertiary)' }}>{t('infoVideo')}: </span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {videoStream.codecName.toUpperCase()}{' '}
                      {videoStream.width && videoStream.height
                        ? `${videoStream.width}×${videoStream.height}`
                        : ''}
                      {videoStream.fps ? ` ${videoStream.fps.toFixed(2)}fps` : ''}
                    </span>
                  </div>
                )}
                {audioStream && (
                  <div className="col-span-1">
                    <span style={{ color: 'var(--text-tertiary)' }}>{t('infoAudio')}: </span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {audioStream.codecName.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {tc('loading')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Output settings ─────────────────────────────────────────────── */}
      <div
        className="rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: '0.5px solid var(--border-default)' }}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('outputSettings')}
          </span>
          <div className="relative">
            <button
              onClick={() => setShowPresets((v) => !v)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '0.5px solid var(--border-default)',
              }}
            >
              {t('preset')}
              <ChevronDown size={12} />
            </button>
            {showPresets && (
              <div className="absolute right-0 top-full z-50 mt-1">
                <PresetSelector
                  onSelect={handlePresetSelect}
                  onClose={() => setShowPresets(false)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 p-4">
          {/* Left column */}
          <div className="flex flex-col gap-4">
            {/* Container */}
            <Select
              label={t('container')}
              size="sm"
              value={state.container}
              onChange={(e) => update('container', e.target.value)}
              options={CONTAINERS.map((c) => ({ value: c.id, label: c.name }))}
            />

            {/* Resolution */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('resolution')}
              </span>
              <select
                className="w-full appearance-none rounded-md pl-2.5 pr-7 text-sm outline-none h-7"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '0.5px solid var(--border-default)',
                }}
                value={state.resolutionPreset}
                onChange={(e) => update('resolutionPreset', e.target.value)}
              >
                {RESOLUTION_PRESETS.map((r) => (
                  <option
                    key={r.id}
                    value={r.id}
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    {r.name}
                  </option>
                ))}
              </select>
              {state.resolutionPreset === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-20 rounded-md px-2 py-1 text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '0.5px solid var(--border-default)',
                    }}
                    value={state.customWidth}
                    onChange={(e) => update('customWidth', parseInt(e.target.value) || 1920)}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>×</span>
                  <input
                    type="number"
                    className="w-20 rounded-md px-2 py-1 text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '0.5px solid var(--border-default)',
                    }}
                    value={state.customHeight}
                    onChange={(e) => update('customHeight', parseInt(e.target.value) || 1080)}
                  />
                </div>
              )}
            </div>

            {/* Scaling Algorithm */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('scalingAlgorithm')}
              </span>
              <select
                className="w-full appearance-none rounded-md pl-2.5 pr-7 text-sm outline-none h-7"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: state.resolutionPreset === 'original' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  border: '0.5px solid var(--border-default)',
                  cursor: state.resolutionPreset === 'original' ? 'not-allowed' : 'pointer',
                }}
                value={state.scalingAlgorithm}
                disabled={state.resolutionPreset === 'original'}
                onChange={(e) => update('scalingAlgorithm', e.target.value as ScalingAlgorithm)}
              >
                <option value="bilinear" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  {t('scalingBilinear')}
                </option>
                <option value="lanczos" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  {t('scalingLanczos')}
                </option>
                <option value="ai" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  {t('scalingAi')}
                </option>
              </select>
              {state.scalingAlgorithm === 'ai' && state.resolutionPreset !== 'original' && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex gap-2">
                    <select
                      className="flex-1 appearance-none rounded-md pl-2.5 pr-7 text-xs outline-none h-7"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        border: '0.5px solid var(--border-default)',
                      }}
                      value={state.aiModel}
                      onChange={(e) => update('aiModel', e.target.value as AiUpscaleModel)}
                    >
                      <option value="realesrgan-x4plus" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        {t('aiModelGeneral')}
                      </option>
                      <option value="realesrgan-x4plus-anime" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        {t('aiModelAnime')}
                      </option>
                      <option value="realesr-animevideov3" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        {t('aiModelVideo')}
                      </option>
                    </select>
                    <select
                      className="w-20 appearance-none rounded-md pl-2.5 pr-7 text-xs outline-none h-7"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        border: '0.5px solid var(--border-default)',
                      }}
                      value={String(state.aiScale)}
                      onChange={(e) => update('aiScale', parseInt(e.target.value) as 2 | 3 | 4)}
                    >
                      <option value="2" style={{ backgroundColor: 'var(--bg-secondary)' }}>2x</option>
                      <option value="3" style={{ backgroundColor: 'var(--bg-secondary)' }}>3x</option>
                      <option value="4" style={{ backgroundColor: 'var(--bg-secondary)' }}>4x</option>
                    </select>
                  </div>
                  {(state.aiModel === 'realesrgan-x4plus' ||
                    state.aiModel === 'realesrgan-x4plus-anime') && (
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      ℹ {t('aiX4plusNote')}
                    </span>
                  )}
                  <span className="text-xs" style={{ color: 'var(--status-warning)' }}>
                    ⚠ {t('aiWarning')}
                  </span>
                </div>
              )}
            </div>

            {/* FPS */}
            <Select
              label={t('fps')}
              size="sm"
              value={state.fps !== null ? String(state.fps) : ''}
              onChange={(e) =>
                update('fps', e.target.value === '' ? null : parseFloat(e.target.value))
              }
              options={FPS_OPTIONS.map((f) => ({
                value: f.value !== null ? String(f.value) : '',
                label: f.label,
              }))}
            />
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Video codec */}
            <Select
              label={t('videoCodec')}
              size="sm"
              value={state.videoCodec}
              onChange={(e) => {
                update('videoCodec', e.target.value);
                update('hwEncoder', 'none');
              }}
              options={VIDEO_CODECS.map((c) => ({ value: c.id, label: c.name }))}
            />

            {/* Audio codec */}
            <Select
              label={t('audioCodec')}
              size="sm"
              value={state.audioCodec}
              onChange={(e) => update('audioCodec', e.target.value)}
              options={AUDIO_CODECS.map((c) => ({ value: c.id, label: c.name }))}
            />

            {/* Bitrate mode */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('bitrateMode')}
              </span>
              <div className="flex rounded-md overflow-hidden" style={{ border: '0.5px solid var(--border-default)' }}>
                {(['crf', 'cbr', 'vbr'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => update('bitrateMode', mode)}
                    className="flex-1 py-1.5 text-xs transition-colors"
                    style={{
                      backgroundColor:
                        state.bitrateMode === mode
                          ? 'var(--accent-cyan-dim)'
                          : 'var(--bg-tertiary)',
                      color:
                        state.bitrateMode === mode
                          ? 'var(--accent-cyan)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>

              {state.bitrateMode === 'crf' ? (
                <Slider
                  min={0}
                  max={51}
                  step={1}
                  value={state.crfValue}
                  onChange={(e) => update('crfValue', parseInt(e.target.value))}
                  label="CRF"
                  valueLabel={`${state.crfValue} (${state.crfValue < 18 ? t('crfHigh') : state.crfValue < 28 ? t('crfMid') : t('crfLow')})`}
                />
              ) : (
                <input
                  type="text"
                  className="rounded-md px-2.5 py-1.5 text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '0.5px solid var(--border-default)',
                  }}
                  placeholder="2000k"
                  value={state.videoBitrate}
                  onChange={(e) => update('videoBitrate', e.target.value)}
                />
              )}
            </div>
          </div>
        </div>

        {/* HW Encoder + 2-pass row */}
        <div
          className="flex items-center gap-4 px-4 pb-4"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              <Cpu size={11} />
              {t('hwEncoder')}
            </span>
            <select
              className="appearance-none rounded-md pl-2.5 pr-7 text-xs outline-none h-7"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '0.5px solid var(--border-default)',
              }}
              value={state.hwEncoder}
              onChange={(e) => update('hwEncoder', e.target.value)}
            >
              {hwOptions.map((o) => (
                <option
                  key={o.value}
                  value={o.value}
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 pt-4">
            <Toggle
              size="sm"
              checked={state.twoPass}
              onChange={(v) => update('twoPass', v)}
              label={t('twoPass')}
            />
          </div>
        </div>
      </div>

      {/* ── Command preview ─────────────────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: '0.5px solid var(--border-default)' }}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('commandPreview')}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs transition-colors"
            style={{ color: copied ? 'var(--accent-cyan)' : 'var(--text-tertiary)' }}
          >
            {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
            {tc('copy')}
          </button>
        </div>
        <pre
          className="overflow-x-auto p-4 text-xs"
          style={{
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {commandPreview}
        </pre>
        {estimatedBytes > 0 && (
          <div
            className="px-4 pb-3 text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('estimatedSize')}: <span style={{ color: 'var(--accent-cyan)' }}>{formatFileSize(estimatedBytes)}</span>
          </div>
        )}
      </div>

      {/* ── Output path ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="shrink-0 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {tc('outputDir')}:
          </span>
          <button
            onClick={handleSelectOutputDir}
            className="truncate text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            {state.outputDir || settingsOutputDir || '~/Downloads'}
          </button>
          <button
            onClick={handleSelectOutputDir}
            className="shrink-0 rounded-md px-2 py-0.5 text-xs"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '0.5px solid var(--border-default)',
            }}
          >
            {tc('change')}
          </button>
        </div>
        <input
          type="text"
          className="w-48 shrink-0 rounded-md px-2.5 py-1.5 text-xs outline-none"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '0.5px solid var(--border-default)',
          }}
          value={state.outputFilename}
          onChange={(e) => update('outputFilename', e.target.value)}
          placeholder="output.mp4"
        />
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 text-xs"
          style={{
            backgroundColor: 'rgba(239,71,111,0.1)',
            border: '0.5px solid var(--status-error)',
            color: 'var(--status-error)',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Convert button ──────────────────────────────────────────────── */}
      <button
        onClick={handleConvert}
        disabled={!state.inputPath || isConverting}
        className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium transition-all"
        style={{
          backgroundColor: !state.inputPath || isConverting
            ? 'var(--bg-tertiary)'
            : 'var(--accent-cyan)',
          color: !state.inputPath || isConverting
            ? 'var(--text-tertiary)'
            : '#0a0a0f',
          cursor: !state.inputPath || isConverting ? 'not-allowed' : 'pointer',
        }}
      >
        <RefreshCw
          size={16}
          className={isConverting ? 'animate-spin' : ''}
        />
        {isConverting ? t('startConversion') + '...' : t('startConversion')}
      </button>
    </div>
  );
}
