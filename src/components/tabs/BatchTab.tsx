'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Upload,
  FolderOpen,
  CheckSquare,
  Square,
  X,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
} from 'lucide-react';
import { useBatchStore } from '@/stores/batchStore';
import { probeMedia, executeFFmpeg, openFileDialog } from '@/lib/tauri/commands';
import { CONTAINERS, VIDEO_CODECS, AUDIO_CODECS, RESOLUTION_PRESETS } from '@/lib/ffmpeg/presets';
import type { FFmpegCommand } from '@/types/ffmpeg';

const STATUS_ICONS = {
  pending: <Clock className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />,
  processing: <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--accent-cyan)' }} />,
  done: <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--status-success)' }} />,
  error: <AlertCircle className="h-3.5 w-3.5" style={{ color: 'var(--status-error)' }} />,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function applyTemplate(template: string, filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return template.replace('{name}', base).replace('{date}', date);
}

export function BatchTab() {
  const t = useTranslations('batch');
  const tc = useTranslations('convert');
  const tCommon = useTranslations('common');

  const {
    files,
    settings,
    isRunning,
    completedCount,
    addFiles,
    removeFile,
    clearFiles,
    toggleSelect,
    selectAll,
    deselectAll,
    updateSettings,
    setFileStatus,
    setFileJobId,
    setRunning,
    incrementCompleted,
  } = useBatchStore();

  const [isDragOver, setIsDragOver] = useState(false);

  const selectedFiles = files.filter((f) => f.selected);
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  // ── File ingestion ──────────────────────────────────────────────────────────

  const ingestPaths = useCallback(
    async (paths: string[]) => {
      addFiles(paths);
      // probe each new file for size
      for (const path of paths) {
        try {
          const info = await probeMedia(path);
          useBatchStore.setState((state) => ({
            files: state.files.map((f) =>
              f.path === path
                ? { ...f, size: info.size ?? 0 }
                : f,
            ),
          }));
        } catch {
          // size stays 0 if probe fails
        }
      }
    },
    [addFiles],
  );

  const handleSelectFiles = async () => {
    try {
      const paths = await openFileDialog(
        'Select Media Files',
        [{ name: 'Media', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'ts', 'mp3', 'wav', 'flac', 'aac', 'm4a'] }],
        true,
        false,
      );
      if (paths && paths.length > 0) await ingestPaths(paths);
    } catch (err) {
      console.error('File dialog error:', err);
    }
  };

  const handleSelectOutputDir = async () => {
    try {
      const paths = await openFileDialog('Select Output Directory', [], false, true);
      if (paths && paths.length > 0) updateSettings({ outputDir: paths[0] });
    } catch (err) {
      console.error('Folder dialog error:', err);
    }
  };

  // ── Drag & Drop (Tauri event) ───────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const webview = getCurrentWebview();
        unlisten = await webview.onDragDropEvent((event) => {
          if (event.payload.type === 'enter') setIsDragOver(true);
          else if (event.payload.type === 'leave') setIsDragOver(false);
          else if (event.payload.type === 'drop') {
            setIsDragOver(false);
            const mediaExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.ts', '.mp3', '.wav', '.flac', '.aac', '.m4a'];
            const paths = event.payload.paths.filter((p: string) =>
              mediaExts.some((ext) => p.toLowerCase().endsWith(ext))
            );
            if (paths.length > 0) ingestPaths(paths);
          }
        });
      } catch { /* not in Tauri */ }
    })();
    return () => { if (unlisten) unlisten(); };
  }, [ingestPaths]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    // Tauri環境ではonDragDropEventで処理するのでスキップ
    if ('__TAURI_INTERNALS__' in window) return;
  };

  // ── Execute ─────────────────────────────────────────────────────────────────

  const handleExecute = async () => {
    const targets = files.filter((f) => f.selected && f.status !== 'done');
    if (targets.length === 0) return;

    setRunning(true);

    // Process with parallelJobs concurrency
    const concurrency = settings.parallelJobs;
    let idx = 0;

    const processNext = async (): Promise<void> => {
      if (idx >= targets.length) return;
      const file = targets[idx++];
      if (!file) return;

      setFileStatus(file.id, 'processing');

      try {
        const outName = applyTemplate(settings.filenameTemplate, file.filename);
        const outputPath = settings.outputDir
          ? `${settings.outputDir}/${outName}.${settings.container}`
          : file.path.replace(/\.[^.]+$/, `_${outName}.${settings.container}`);

        // Parse resolution string (e.g. "1920x1080") into Resolution type
        const resolutionObj = (() => {
          if (settings.resolution === 'original') return undefined;
          const [w, h] = settings.resolution.split('x').map(Number);
          return w && h ? { width: w, height: h } : undefined;
        })();

        const command: FFmpegCommand = {
          inputPath: file.path,
          outputPath,
          videoCodec: settings.videoCodec,
          audioCodec: settings.audioCodec,
          container: settings.container,
          filters: [],
          extraArgs: [],
          twoPass: false,
          copyVideo: false,
          copyAudio: false,
          noVideo: settings.operation === 'extract_audio',
          noAudio: false,
          ...(resolutionObj ? { resolution: resolutionObj } : {}),
        };

        const jobId = await executeFFmpeg(command);
        setFileJobId(file.id, jobId);
        setFileStatus(file.id, 'done');
        incrementCompleted();
      } catch (err) {
        setFileStatus(file.id, 'error', String(err));
      }

      await processNext();
    };

    const workers = Array.from({ length: concurrency }, () => processNext());
    await Promise.all(workers);

    setRunning(false);
  };

  const allSelected = files.length > 0 && files.every((f) => f.selected);

  return (
    <div className="flex h-full gap-4 p-6">
      {/* ── Left: File list ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-3 min-w-0">
        {/* Drop zone */}
        <motion.div
          className="flex flex-col items-center justify-center gap-3 rounded-xl py-8 cursor-pointer transition-colors"
          style={{
            backgroundColor: isDragOver ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
            border: isDragOver
              ? '1px dashed var(--accent-cyan)'
              : '1px dashed var(--border-hover)',
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleSelectFiles}
          whileHover={{ scale: 1.005 }}
        >
          <Upload className="h-7 w-7" style={{ color: isDragOver ? 'var(--accent-cyan)' : 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('dropMultiple')}
          </p>
          <button
            className="rounded-lg px-4 py-1.5 text-xs transition-colors"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '0.5px solid var(--border-default)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleSelectFiles();
            }}
          >
            {tCommon('add')}
          </button>
        </motion.div>

        {/* File list */}
        <div
          className="flex flex-1 flex-col rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '0.5px solid var(--border-default)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ borderBottom: '0.5px solid var(--border-default)' }}
          >
            <button
              onClick={allSelected ? deselectAll : selectAll}
              className="shrink-0"
              title={allSelected ? t('deselectAll') : t('selectAll')}
            >
              {allSelected
                ? <CheckSquare className="h-3.5 w-3.5" style={{ color: 'var(--accent-cyan)' }} />
                : <Square className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
              }
            </button>
            <Package className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
            <p className="flex-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('fileList')}
              {files.length > 0 && (
                <span className="ml-2" style={{ color: 'var(--text-tertiary)' }}>
                  ({selectedFiles.length}/{files.length})
                </span>
              )}
            </p>
            {totalSize > 0 && (
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('totalSize')}: {formatBytes(totalSize)}
              </span>
            )}
            {files.length > 0 && (
              <button
                onClick={clearFiles}
                className="text-xs transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-tertiary)' }}
                title={t('clearList')}
              >
                {t('clearList')}
              </button>
            )}
          </div>

          {/* File rows */}
          <div className="flex-1 overflow-y-auto">
            {files.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8">
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {t('dropMultiple')}
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {files.map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: '0.5px solid var(--border-default)' }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelect(file.id)}
                      className="shrink-0"
                      disabled={isRunning}
                    >
                      {file.selected
                        ? <CheckSquare className="h-3.5 w-3.5" style={{ color: 'var(--accent-cyan)' }} />
                        : <Square className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                      }
                    </button>

                    {/* Status */}
                    <span className="shrink-0">{STATUS_ICONS[file.status]}</span>

                    {/* Filename */}
                    <span
                      className="flex-1 truncate text-xs"
                      style={{ color: 'var(--text-primary)' }}
                      title={file.path}
                    >
                      {file.filename}
                    </span>

                    {/* Format badge */}
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {file.format}
                    </span>

                    {/* Size */}
                    <span className="shrink-0 w-16 text-right text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {formatBytes(file.size)}
                    </span>

                    {/* Progress */}
                    {file.status === 'processing' && file.progress != null && (
                      <span className="shrink-0 text-xs" style={{ color: 'var(--accent-cyan)' }}>
                        {file.progress}%
                      </span>
                    )}

                    {/* Error */}
                    {file.status === 'error' && file.error && (
                      <span
                        className="shrink-0 max-w-[100px] truncate text-xs"
                        style={{ color: 'var(--status-error)' }}
                        title={file.error}
                      >
                        {file.error}
                      </span>
                    )}

                    {/* Remove */}
                    <button
                      onClick={() => removeFile(file.id)}
                      disabled={isRunning}
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-70"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Progress bar (when running) */}
          {isRunning && (
            <div
              className="px-3 py-2"
              style={{ borderTop: '0.5px solid var(--border-default)' }}
            >
              <div className="mb-1 flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span>{completedCount} / {selectedFiles.length}</span>
                <span>{Math.round((completedCount / Math.max(selectedFiles.length, 1)) * 100)}%</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: 'var(--accent-cyan)' }}
                  animate={{ width: `${(completedCount / Math.max(selectedFiles.length, 1)) * 100}%` }}
                  transition={{ ease: 'easeOut', duration: 0.3 }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Settings ────────────────────────────────────────────────── */}
      <div
        className="flex w-72 shrink-0 flex-col rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 p-3"
          style={{ borderBottom: '0.5px solid var(--border-default)' }}
        >
          <Package className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('commonSettings')}
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          {/* Operation */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {tCommon('operations')}
            </label>
            <div className="flex gap-1">
              {(['convert', 'extract_audio'] as const).map((op) => (
                <button
                  key={op}
                  onClick={() => updateSettings({ operation: op })}
                  className="flex-1 rounded-lg py-1.5 text-xs font-medium transition-all"
                  style={{
                    backgroundColor: settings.operation === op ? 'color-mix(in srgb, var(--accent-cyan) 15%, transparent)' : 'var(--bg-tertiary)',
                    color: settings.operation === op ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    border: settings.operation === op ? '0.5px solid var(--accent-cyan)' : '0.5px solid var(--border-default)',
                  }}
                >
                  {op === 'convert' ? tc('startConversion') : 'Extract Audio'}
                </button>
              ))}
            </div>
          </div>

          {/* Container */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {tc('container')}
            </label>
            <select
              value={settings.container}
              onChange={(e) => updateSettings({ container: e.target.value })}
              className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '0.5px solid var(--border-default)',
              }}
            >
              {CONTAINERS.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Video Codec */}
          {settings.operation !== 'extract_audio' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {tc('videoCodec')}
              </label>
              <select
                value={settings.videoCodec}
                onChange={(e) => updateSettings({ videoCodec: e.target.value })}
                className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '0.5px solid var(--border-default)',
                }}
              >
                {VIDEO_CODECS.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Audio Codec */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {tc('audioCodec')}
            </label>
            <select
              value={settings.audioCodec}
              onChange={(e) => updateSettings({ audioCodec: e.target.value })}
              className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '0.5px solid var(--border-default)',
              }}
            >
              {AUDIO_CODECS.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Resolution */}
          {settings.operation !== 'extract_audio' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {tc('resolution')}
              </label>
              <select
                value={settings.resolution}
                onChange={(e) => updateSettings({ resolution: e.target.value })}
                className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '0.5px solid var(--border-default)',
                }}
              >
                <option value="original">{tc('keepOriginal')}</option>
                {RESOLUTION_PRESETS.filter((r) => r.id !== 'original' && r.id !== 'custom').map((r) => (
                  <option key={r.id} value={`${r.width}x${r.height}`}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Filename Template */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('filenameTemplate')}
            </label>
            <input
              type="text"
              value={settings.filenameTemplate}
              onChange={(e) => updateSettings({ filenameTemplate: e.target.value })}
              placeholder="{name}_converted"
              className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '0.5px solid var(--border-default)',
              }}
            />
            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {'{name}'}, {'{date}'}
            </p>
          </div>

          {/* Parallel Jobs */}
          <div className="space-y-1.5">
            <label className="flex justify-between text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              <span>{t('parallelJobs')}</span>
              <span style={{ color: 'var(--accent-cyan)' }}>{settings.parallelJobs}</span>
            </label>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={settings.parallelJobs}
              onChange={(e) => updateSettings({ parallelJobs: Number(e.target.value) })}
              className="w-full accent-[var(--accent-cyan)]"
            />
            <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              <span>1</span><span>8</span>
            </div>
          </div>

          {/* Output Dir */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {tCommon('outputDir')}
            </label>
            <div className="flex gap-1.5">
              <div
                className="flex-1 truncate rounded-lg px-2.5 py-2 text-xs"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: settings.outputDir ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border: '0.5px solid var(--border-default)',
                }}
                title={settings.outputDir}
              >
                {settings.outputDir || '—'}
              </div>
              <button
                onClick={handleSelectOutputDir}
                className="shrink-0 rounded-lg px-2.5 py-2 text-xs transition-colors hover:opacity-80"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  border: '0.5px solid var(--border-default)',
                }}
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Execute Button */}
        <div className="p-3" style={{ borderTop: '0.5px solid var(--border-default)' }}>
          <button
            onClick={handleExecute}
            disabled={selectedFiles.length === 0 || isRunning}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all"
            style={{
              backgroundColor:
                selectedFiles.length === 0 || isRunning
                  ? 'var(--bg-tertiary)'
                  : 'color-mix(in srgb, var(--accent-cyan) 15%, transparent)',
              color:
                selectedFiles.length === 0 || isRunning
                  ? 'var(--text-tertiary)'
                  : 'var(--accent-cyan)',
              border:
                selectedFiles.length === 0 || isRunning
                  ? '0.5px solid var(--border-default)'
                  : '0.5px solid var(--accent-cyan)',
            }}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {completedCount} / {selectedFiles.length}
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4" />
                {t('execute')}
                {selectedFiles.length > 0 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-xs"
                    style={{ backgroundColor: 'var(--accent-cyan)', color: '#000' }}
                  >
                    {selectedFiles.length}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
