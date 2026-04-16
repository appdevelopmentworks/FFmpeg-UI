'use client';

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Combine,
  FolderOpen,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileVideo,
  FileAudio,
} from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/Button';
import { DropZone } from '@/components/ui/DropZone';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Input } from '@/components/ui/Input';
import { useMerge } from '@/hooks/useMerge';
import { fadeIn, slideUp, staggerContainer, staggerItem } from '@/lib/animations';

// ── Helpers ────────────────────────────────────────────────────────────────────

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma', 'opus'];
const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'ts', 'm4v', 'wmv'];
const ALL_MEDIA_EXTENSIONS = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS];

function isAudioFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_EXTENSIONS.includes(ext);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function MergeTab() {
  const t = useTranslations('merge');
  const tc = useTranslations('common');

  const {
    files,
    outputPath,
    probeState,
    job,
    addFiles,
    removeFile,
    moveFile,
    setOutputPath,
    executeMerge,
    reset: resetStore,
  } = useMerge();

  const handleFileDrop = useCallback(
    async (paths: string[]) => {
      if (paths.length > 0) addFiles(paths);
    },
    [addFiles],
  );

  const handleAddMore = useCallback(async () => {
    try {
      const result = await openDialog({
        multiple: true,
        filters: [{ name: 'Media', extensions: ALL_MEDIA_EXTENSIONS }],
      });
      if (result && Array.isArray(result) && result.length > 0) {
        addFiles(result);
      } else if (result && typeof result === 'string') {
        addFiles([result]);
      }
    } catch (err) {
      console.error('[MergeTab] open dialog error:', err);
    }
  }, [addFiles]);

  const handleChooseOutput = useCallback(async () => {
    try {
      const result = await openDialog({
        multiple: false,
        filters: [{ name: 'Media', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm'] }],
      });
      if (result && typeof result === 'string') setOutputPath(result);
    } catch (err) {
      console.error('[MergeTab] save dialog error:', err);
    }
  }, [setOutputPath]);

  const isRunning = job.status === 'running';
  const isComplete = job.status === 'complete';
  const hasError = job.status === 'error';
  const isProbing = probeState === 'loading';
  const hasFiles = files.length > 0;
  const canExecute = files.length >= 2 && !!outputPath && !isRunning;

  const totalDuration = files.reduce((sum, f) => sum + f.duration, 0);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      {/* ── DropZone ─────────────────────────────────────────────────────── */}
      <DropZone
        multiple
        onFileDrop={handleFileDrop}
        accept={ALL_MEDIA_EXTENSIONS.map((e) => `.${e}`)}
        label={tc('dragOrClick')}
        sublabel="動画: mp4, mkv, avi, mov / 音声: mp3, wav, flac, aac, m4a"
        className="py-8"
        disabled={isRunning}
      />

      {/* ── File List ────────────────────────────────────────────────────── */}
      {hasFiles && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-2"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {t('fileList')}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  backgroundColor: 'rgba(6,214,160,0.1)',
                  color: 'var(--accent-cyan)',
                }}
              >
                {files.length}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <span>{formatDuration(totalDuration)}</span>
              <span>{formatBytes(totalSize)}</span>
            </div>
          </div>

          {/* Items */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-1"
          >
            {files.map((file, index) => (
              <motion.div
                key={`${file.path}-${index}`}
                variants={staggerItem}
                className="group flex items-center gap-3 rounded-xl px-4 py-2.5"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '0.5px solid var(--border-default)',
                }}
              >
                {/* Index */}
                <span
                  className="w-5 shrink-0 text-center text-xs font-medium"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {index + 1}
                </span>

                {/* Icon */}
                {isAudioFile(file.path) ? (
                  <FileAudio className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-blue)' }} />
                ) : (
                  <FileVideo className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-cyan)' }} />
                )}

                {/* Filename */}
                <span
                  className="flex-1 truncate text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {file.name}
                </span>

                {/* Duration & Size */}
                <span
                  className="shrink-0 text-xs"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {formatDuration(file.duration)}
                </span>
                <span
                  className="w-16 shrink-0 text-right text-xs"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {formatBytes(file.size)}
                </span>

                {/* Reorder buttons */}
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => moveFile(index, index - 1)}
                    disabled={index === 0}
                    className="rounded p-1 transition-colors hover:bg-white/10 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <button
                    onClick={() => moveFile(index, index + 1)}
                    disabled={index === files.length - 1}
                    className="rounded p-1 transition-colors hover:bg-white/10 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => removeFile(index)}
                  className="shrink-0 rounded p-1 transition-colors hover:bg-white/10 opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </motion.div>
            ))}
          </motion.div>

          {/* Add more button */}
          <button
            onClick={handleAddMore}
            disabled={isRunning}
            className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-colors hover:bg-white/5 disabled:opacity-50"
            style={{
              border: '0.5px dashed var(--border-default)',
              color: 'var(--text-secondary)',
            }}
          >
            {isProbing ? (
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent-cyan)' }} />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {t('addFile')}
          </button>

          {/* ── Output path ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-2">
            <Input
              label={t('outputPath')}
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              className="flex-1"
            />
            <div className="mt-5">
              <Button variant="secondary" size="sm" onClick={handleChooseOutput}>
                {tc('change')}
              </Button>
            </div>
          </div>

          {/* ── Execute button ───────────────────────────────────────────── */}
          <Button
            variant="primary"
            size="lg"
            icon={<Combine className="h-4 w-4" />}
            loading={isRunning}
            disabled={!canExecute}
            onClick={executeMerge}
          >
            {t('execute')}
          </Button>

          {/* ── Progress / Complete / Error ───────────────────────────────── */}
          {(isRunning || isComplete || hasError) && (
            <motion.div
              variants={slideUp}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-3 rounded-xl p-4"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: `0.5px solid ${hasError ? 'var(--status-error)' : isComplete ? 'var(--status-success)' : 'var(--border-default)'}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isComplete && (
                    <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--status-success)' }} />
                  )}
                  {hasError && (
                    <AlertCircle className="h-4 w-4" style={{ color: 'var(--status-error)' }} />
                  )}
                  {isRunning && (
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent-cyan)' }} />
                  )}
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {isComplete ? t('complete') : hasError ? job.error : t('running')}
                  </span>
                </div>
              </div>

              {(isRunning || isComplete) && (
                <ProgressBar value={job.percent} animated={isRunning} />
              )}

              {isRunning && (
                <div className="flex gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <span>{job.percent.toFixed(1)}%</span>
                  {job.speed && <span>{job.speed}</span>}
                  {job.eta && (
                    <span>
                      {tc('remaining')} {job.eta}
                    </span>
                  )}
                </div>
              )}

              {isComplete && job.outputPath && (
                <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {job.outputPath}
                </p>
              )}
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
