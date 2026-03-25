import { invoke } from '@tauri-apps/api/core';
import type { MediaInfo, WaveformData } from '@/types/media';
import type { FFmpegCommand, HWEncoder } from '@/types/ffmpeg';
import type { VideoInfo, DownloadParams, DownloadProgress } from '@/types/ytdlp';
import type { Job } from '@/types/job';
import type { Preset, PresetList } from '@/types/preset';
import type {
  AppSettings,
  BinaryStatus,
  UpdateInfo,
  SystemInfo,
} from '@/types/settings';
import type {
  FileFilter,
  ExtractParams,
  TrimParams,
  RecordingParams,
  StreamProbeResult,
  EstimateParams,
} from '@/types/ui';

// ── Setup ────────────────────────────────────────────────────────────────────
export const checkBinaries = () => invoke<BinaryStatus>('check_binaries');

export const downloadBinary = (tool: 'ffmpeg' | 'ytdlp') =>
  invoke<string>('download_binary', { tool });

export const checkUpdates = () => invoke<UpdateInfo>('check_updates');

// ── Media ────────────────────────────────────────────────────────────────────
export const probeMedia = (path: string) =>
  invoke<MediaInfo>('probe_media', { path });

export const generateThumbnails = (path: string, count?: number) =>
  invoke<string[]>('generate_thumbnails', {
    path,
    count: count ?? 20,
    width: 160,
    height: 90,
  });

export const generateWaveform = (path: string, samples?: number) =>
  invoke<WaveformData>('generate_waveform', { path, samples: samples ?? 1000 });

// ── YouTube ──────────────────────────────────────────────────────────────────
export const fetchVideoInfo = (url: string) =>
  invoke<VideoInfo>('fetch_video_info', { url });

export const startDownload = (params: DownloadParams) =>
  invoke<string>('start_download', { ...params });

export const cancelDownload = (jobId: string) =>
  invoke<void>('cancel_download', { jobId });

export const getPreviewUrl = (url: string) =>
  invoke<string>('get_preview_url', { url });

// ── FFmpeg ───────────────────────────────────────────────────────────────────
export const executeFFmpeg = (command: FFmpegCommand) =>
  invoke<string>('execute_ffmpeg', { command });

export const executeRawCommand = (commandString: string) =>
  invoke<string>('execute_raw_command', { commandString });

export const extractStreams = (params: ExtractParams) =>
  invoke<string>('extract_streams', { ...params });

export const trimMedia = (params: TrimParams) =>
  invoke<string>('trim_media', { ...params });

export const detectHwEncoders = () => invoke<HWEncoder[]>('detect_hw_encoders');

export const buildCommandPreview = (command: FFmpegCommand) =>
  invoke<string>('build_command_preview', { command });

export const estimateOutputSize = (params: EstimateParams) =>
  invoke<number>('estimate_output_size', { ...params });

// ── Jobs ─────────────────────────────────────────────────────────────────────
export const getJobs = () => invoke<Job[]>('get_jobs');

export const cancelJob = (jobId: string) => invoke<void>('cancel_job', { jobId });

export const pauseJob = (jobId: string) => invoke<void>('pause_job', { jobId });

export const resumeJob = (jobId: string) => invoke<void>('resume_job', { jobId });

export const reorderJobs = (jobIds: string[]) =>
  invoke<void>('reorder_jobs', { jobIds });

export const clearCompletedJobs = () => invoke<number>('clear_completed_jobs');

// ── Presets ──────────────────────────────────────────────────────────────────
export const getPresets = () => invoke<PresetList>('get_presets');

export const savePreset = (preset: Preset) =>
  invoke<string>('save_preset', { preset });

export const deletePreset = (presetId: string) =>
  invoke<void>('delete_preset', { presetId });

export const exportPresets = (path: string) =>
  invoke<void>('export_presets', { path });

export const importPresets = (path: string) =>
  invoke<number>('import_presets', { path });

// ── Settings ─────────────────────────────────────────────────────────────────
export const getSettings = () => invoke<AppSettings>('get_settings');

export const updateSettings = (settings: AppSettings) =>
  invoke<void>('update_settings', { settings });

export const resetSettings = () => invoke<AppSettings>('reset_settings');

export const exportSettings = (path: string) =>
  invoke<void>('export_settings', { path });

export const importSettings = (path: string) =>
  invoke<void>('import_settings', { path });

// ── Streaming ────────────────────────────────────────────────────────────────
export const probeStream = (url: string) =>
  invoke<StreamProbeResult>('probe_stream', { url });

export const startRecording = (params: RecordingParams) =>
  invoke<string>('start_recording', { ...params });

export const stopRecording = (jobId: string) =>
  invoke<string>('stop_recording', { jobId });

// ── Utility ──────────────────────────────────────────────────────────────────
export const openFileDialog = (
  title?: string,
  filters?: FileFilter[],
  multiple?: boolean,
  directory?: boolean,
) => invoke<string[]>('open_file_dialog', { title, filters, multiple, directory });

export const openSaveDialog = (
  title?: string,
  defaultPath?: string,
  filters?: FileFilter[],
) => invoke<string | null>('open_save_dialog', { title, defaultPath, filters });

export const openInExplorer = (path: string) =>
  invoke<void>('open_in_explorer', { path });

export const getSystemInfo = () => invoke<SystemInfo>('get_system_info');

export type { DownloadProgress };
