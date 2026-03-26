'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Youtube,
  Link,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  Download,
  X,
  ChevronDown,
  ChevronUp,
  Play,
} from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import { useYtDlp } from '@/hooks/useYtDlp';
import { useSettingsStore } from '@/stores/settingsStore';
import type { DownloadFormat } from '@/types/ytdlp';
import { fadeIn, slideUp } from '@/lib/animations';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatViewCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes >= 1024 ** 3) return `~${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `~${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `~${(bytes / 1024).toFixed(0)} KB`;
}

function formatUploadDate(dateStr: string): string {
  if (dateStr.length !== 8) return dateStr;
  const y = dateStr.slice(0, 4);
  const m = dateStr.slice(4, 6);
  const d = dateStr.slice(6, 8);
  return `${y}/${m}/${d}`;
}

type ModeFilter = 'videoAndAudio' | 'videoOnly' | 'audioOnly';

function filterFormats(formats: DownloadFormat[], mode: ModeFilter): DownloadFormat[] {
  return formats
    .filter((f) => {
      if (mode === 'videoAndAudio') return f.hasVideo && f.hasAudio;
      if (mode === 'videoOnly') return f.hasVideo && !f.hasAudio;
      return f.hasAudio && !f.hasVideo;
    })
    .sort((a, b) => {
      const sizeA = a.filesize ?? a.filesizeApprox ?? 0;
      const sizeB = b.filesize ?? b.filesizeApprox ?? 0;
      return sizeB - sizeA;
    });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FormatRow({
  format,
  selected,
  onSelect,
}: {
  format: DownloadFormat;
  selected: boolean;
  onSelect: () => void;
}) {
  const size = format.filesize ?? format.filesizeApprox;
  const codec = format.hasVideo
    ? format.vcodec?.replace('avc1', 'H.264').replace('vp09', 'VP9').replace('av01', 'AV1') ?? ''
    : format.acodec ?? '';

  return (
    <motion.button
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors"
      style={{
        backgroundColor: selected ? 'rgba(6, 214, 160, 0.08)' : 'transparent',
        border: `0.5px solid ${selected ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
      }}
      whileHover={{ backgroundColor: selected ? 'rgba(6, 214, 160, 0.12)' : 'rgba(255,255,255,0.03)' }}
      whileTap={{ scale: 0.995 }}
    >
      {/* Radio indicator */}
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
        style={{
          borderColor: selected ? 'var(--accent-cyan)' : 'var(--border-default)',
          backgroundColor: selected ? 'var(--accent-cyan)' : 'transparent',
        }}
      >
        {selected && (
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-primary)' }} />
        )}
      </span>

      {/* Quality label */}
      <span className="w-28 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {format.formatNote || format.resolution || format.formatId}
      </span>

      {/* Ext badge */}
      <span
        className="rounded px-1.5 py-0.5 text-xs font-mono uppercase"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          color: 'var(--text-secondary)',
        }}
      >
        {format.ext}
      </span>

      {/* Codec */}
      <span className="flex-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {codec}
      </span>

      {/* Size */}
      {size ? (
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {formatBytes(size)}
        </span>
      ) : null}
    </motion.button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function YouTubeTab() {
  const t = useTranslations('youtube');
  const tc = useTranslations('common');
  const defaultOutputDir = useSettingsStore((s) => s.outputDir);

  const {
    url,
    fetchState,
    videoInfo,
    fetchError,
    selectedFormatId,
    outputDir,
    download,
    setSelectedFormatId,
    setOutputDir,
    fetchInfo,
    startDownload,
    cancelDownload,
  } = useYtDlp();

  const [inputUrl, setInputUrl] = useState(url);
  const [mode, setMode] = useState<ModeFilter>('videoAndAudio');
  const [descExpanded, setDescExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize outputDir from settings
  useEffect(() => {
    if (!outputDir && defaultOutputDir) {
      setOutputDir(defaultOutputDir);
    }
  }, [outputDir, defaultOutputDir, setOutputDir]);

  // Paste detection — auto-fetch on paste
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData('text').trim();
      if (pasted.includes('youtube.com/watch') || pasted.includes('youtu.be/')) {
        setInputUrl(pasted);
        fetchInfo(pasted);
      }
    },
    [fetchInfo],
  );

  const handleFetch = useCallback(() => {
    const trimmed = inputUrl.trim();
    if (trimmed) fetchInfo(trimmed);
  }, [inputUrl, fetchInfo]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleFetch();
    },
    [handleFetch],
  );

  const handleChooseOutputDir = useCallback(async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        setOutputDir(selected);
      }
    } catch (err) {
      console.error('[YouTubeTab] openDialog error:', err);
    }
  }, [setOutputDir]);

  const handleDownload = useCallback(async () => {
    if (!videoInfo || !selectedFormatId) return;
    const dir = outputDir || defaultOutputDir;
    await startDownload({
      url: inputUrl,
      formatId: selectedFormatId,
      outputDir: dir,
      mergeFormat: mode === 'videoAndAudio' ? 'mp4' : undefined,
    });
  }, [videoInfo, selectedFormatId, outputDir, defaultOutputDir, inputUrl, mode, startDownload]);

  // Sync mode → reset selectedFormatId when mode changes
  useEffect(() => {
    if (!videoInfo) return;
    const filtered = filterFormats(videoInfo.formats, mode);
    if (filtered.length > 0) {
      setSelectedFormatId(filtered[0].formatId);
    } else {
      setSelectedFormatId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, videoInfo]);

  const modeOptions = [
    { value: 'videoAndAudio' as const, label: t('videoAndAudio') },
    { value: 'videoOnly' as const, label: t('videoOnly') },
    { value: 'audioOnly' as const, label: t('audioOnly') },
  ];

  const filteredFormats = videoInfo ? filterFormats(videoInfo.formats, mode) : [];
  const isDownloading = download.status === 'downloading';
  const isComplete = download.status === 'complete';
  const hasError = download.status === 'error';

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      {/* URL Input */}
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <Link className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
        <input
          ref={inputRef}
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder={t('urlPlaceholder')}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--text-primary)', caretColor: 'var(--accent-cyan)' }}
          disabled={fetchState === 'loading'}
        />
        {fetchState === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: 'var(--accent-cyan)' }} />
        ) : (
          <button
            onClick={handleFetch}
            disabled={!inputUrl.trim()}
            className="rounded-lg px-3 py-1 text-sm font-medium transition-colors disabled:opacity-40"
            style={{ backgroundColor: 'rgba(6,214,160,0.12)', color: 'var(--accent-cyan)' }}
          >
            {t('fetch')}
          </button>
        )}
      </div>

      {/* Error state */}
      <AnimatePresence>
        {fetchState === 'error' && fetchError && (
          <motion.div
            {...fadeIn}
            className="flex items-start gap-3 rounded-xl px-4 py-3"
            style={{
              backgroundColor: 'rgba(239,71,111,0.08)',
              border: '0.5px solid var(--status-error)',
            }}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--status-error)' }} />
            <p className="text-sm" style={{ color: 'var(--status-error)' }}>
              {fetchError}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeleton */}
      <AnimatePresence>
        {fetchState === 'loading' && (
          <motion.div {...fadeIn} className="flex gap-4 rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '0.5px solid var(--border-default)' }}>
            <div className="h-36 w-64 shrink-0 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }} />
            <div className="flex flex-1 flex-col gap-3 pt-2">
              <div className="h-4 animate-pulse rounded" style={{ backgroundColor: 'var(--bg-tertiary)', width: '80%' }} />
              <div className="h-3 animate-pulse rounded" style={{ backgroundColor: 'var(--bg-tertiary)', width: '50%' }} />
              <div className="h-3 animate-pulse rounded" style={{ backgroundColor: 'var(--bg-tertiary)', width: '40%' }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video info card */}
      <AnimatePresence>
        {fetchState === 'success' && videoInfo && (
          <motion.div
            {...slideUp}
            className="flex gap-4 rounded-xl p-4"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '0.5px solid var(--border-default)',
            }}
          >
            {/* Thumbnail */}
            <div className="relative h-36 w-64 shrink-0 overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity hover:opacity-100">
                <Play className="h-10 w-10" style={{ color: 'white' }} />
              </div>
            </div>

            {/* Metadata */}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                {videoInfo.title}
              </h3>

              <div className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{t('channel')}: </span>
                  {videoInfo.channel}
                </span>
                <span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{t('duration')}: </span>
                  {formatDuration(videoInfo.duration)}
                </span>
                <span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{t('uploadDate')}: </span>
                  {formatUploadDate(videoInfo.uploadDate)}
                </span>
                <span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{t('viewCount')}: </span>
                  {formatViewCount(videoInfo.viewCount)}
                </span>
              </div>

              {/* Description collapsible */}
              {videoInfo.description && (
                <div className="mt-1">
                  <button
                    onClick={() => setDescExpanded((v) => !v)}
                    className="flex items-center gap-1 text-xs transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {descExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {descExpanded ? t('hideDesc') : t('showDesc')}
                  </button>
                  <AnimatePresence>
                    {descExpanded && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-1 overflow-hidden text-xs leading-relaxed"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {videoInfo.description.slice(0, 300)}
                        {videoInfo.description.length > 300 ? '...' : ''}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Format selection */}
      <AnimatePresence>
        {fetchState === 'success' && videoInfo && (
          <motion.div {...slideUp} className="flex flex-col gap-4">
            {/* Mode selector */}
            <SegmentedControl
              options={modeOptions}
              value={mode}
              onChange={(v) => setMode(v as ModeFilter)}
            />

            {/* Format list */}
            <div className="flex flex-col gap-1.5">
              {filteredFormats.length === 0 ? (
                <p className="py-4 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {t('noFormats')}
                </p>
              ) : (
                filteredFormats.map((fmt) => (
                  <FormatRow
                    key={fmt.formatId}
                    format={fmt}
                    selected={fmt.formatId === selectedFormatId}
                    onSelect={() => setSelectedFormatId(fmt.formatId)}
                  />
                ))
              )}
            </div>

            {/* Output directory */}
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <span
                className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '0.5px solid var(--border-default)',
                  color: outputDir ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
              >
                {outputDir || tc('outputDir')}
              </span>
              <Button variant="secondary" size="sm" onClick={handleChooseOutputDir}>
                {tc('change')}
              </Button>
            </div>

            {/* Download button */}
            <Button
              variant="primary"
              size="lg"
              icon={isDownloading ? undefined : <Download className="h-4 w-4" />}
              loading={isDownloading}
              disabled={!selectedFormatId || isDownloading}
              onClick={handleDownload}
            >
              {isDownloading ? '...' : t('download')}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Download progress */}
      <AnimatePresence>
        {(isDownloading || isComplete || hasError) && (
          <motion.div
            {...slideUp}
            className="flex flex-col gap-3 rounded-xl p-4"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: `0.5px solid ${hasError ? 'var(--status-error)' : isComplete ? 'var(--status-success)' : 'var(--border-default)'}`,
            }}
          >
            {/* Status header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isComplete && (
                  <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--status-success)' }} />
                )}
                {hasError && (
                  <AlertCircle className="h-4 w-4" style={{ color: 'var(--status-error)' }} />
                )}
                {isDownloading && (
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent-cyan)' }} />
                )}
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {isComplete ? t('downloadComplete') : hasError ? download.error ?? tc('error') : download.progress?.status === 'merging' ? t('merging') : download.progress?.status === 'post-processing' ? t('postProcessing') : t('downloading')}
                </span>
              </div>

              {isDownloading && (
                <button onClick={cancelDownload} className="rounded p-1 transition-colors hover:opacity-70">
                  <X className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              )}
            </div>

            {/* Progress bar */}
            {(isDownloading || isComplete) && (
              <ProgressBar
                value={isComplete ? 100 : (download.progress?.percent ?? 0)}
                animated={isDownloading}
              />
            )}

            {/* Speed / ETA */}
            {isDownloading && download.progress && (
              <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <span>{download.progress.percent.toFixed(1)}%</span>
                {download.progress.speed && <span>{download.progress.speed}</span>}
                {download.progress.eta && <span>{tc('remaining')} {download.progress.eta}</span>}
              </div>
            )}

            {/* Output path */}
            {isComplete && download.outputPath && (
              <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                {download.outputPath}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      <AnimatePresence>
        {fetchState === 'idle' && (
          <motion.div
            {...fadeIn}
            className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl py-16"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '0.5px solid var(--border-default)',
            }}
          >
            <Youtube className="h-12 w-12" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {t('urlPlaceholder')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
