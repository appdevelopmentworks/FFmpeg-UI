'use client';

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Video,
  Music,
  FileText,
  FolderOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  X,
} from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/Button';
import { DropZone } from '@/components/ui/DropZone';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Select } from '@/components/ui/Select';
import { useExtract } from '@/hooks/useExtract';
import { useExtractStore } from '@/stores/extractStore';
import type { StreamInfo } from '@/types/media';
import { fadeIn, slideUp } from '@/lib/animations';

// ── Format options per stream type ────────────────────────────────────────────

const VIDEO_FORMATS = [
  { value: 'mp4', label: 'MP4' },
  { value: 'mkv', label: 'MKV' },
  { value: 'webm', label: 'WebM' },
  { value: 'avi', label: 'AVI' },
];

const AUDIO_FORMATS = [
  { value: 'mp3', label: 'MP3' },
  { value: 'aac', label: 'AAC' },
  { value: 'flac', label: 'FLAC' },
  { value: 'wav', label: 'WAV' },
  { value: 'opus', label: 'Opus' },
];

const SUBTITLE_FORMATS = [
  { value: 'srt', label: 'SRT' },
  { value: 'ass', label: 'ASS' },
  { value: 'vtt', label: 'VTT' },
];

function formatOptionsFor(streamType: string) {
  if (streamType === 'video') return VIDEO_FORMATS;
  if (streamType === 'audio') return AUDIO_FORMATS;
  if (streamType === 'subtitle') return SUBTITLE_FORMATS;
  return [{ value: 'bin', label: 'BIN' }];
}

// ── Stream icon ───────────────────────────────────────────────────────────────

function StreamIcon({ type }: { type: string }) {
  const style = { width: 14, height: 14 };
  if (type === 'video') return <Video style={{ ...style, color: 'var(--accent-blue)' }} />;
  if (type === 'audio') return <Music style={{ ...style, color: 'var(--accent-cyan)' }} />;
  if (type === 'subtitle') return <FileText style={{ ...style, color: 'var(--status-warning)' }} />;
  return <Layers style={{ ...style, color: 'var(--text-tertiary)' }} />;
}

// ── Stream detail string ──────────────────────────────────────────────────────

function streamDetail(s: StreamInfo): string {
  const parts: string[] = [];
  if (s.codecName) parts.push(s.codecName.toUpperCase());
  if (s.streamType === 'video') {
    if (s.width && s.height) parts.push(`${s.width}×${s.height}`);
    if (s.fps) parts.push(`${s.fps.toFixed(2)} fps`);
    if (s.bitRate) parts.push(`${(s.bitRate / 1000).toFixed(0)} kbps`);
  } else if (s.streamType === 'audio') {
    if (s.channelLayout) parts.push(s.channelLayout);
    if (s.sampleRate) parts.push(`${s.sampleRate} Hz`);
    if (s.bitRate) parts.push(`${(s.bitRate / 1000).toFixed(0)} kbps`);
  }
  if (s.language) parts.push(s.language);
  return parts.join('  ·  ');
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ExtractTab() {
  const t = useTranslations('extract');
  const tc = useTranslations('common');

  const {
    filePath, mediaInfo, probeState, probeError,
    selections, outputDir, job,
    setOutputDir, updateSelection,
    loadFile, executeExtract,
  } = useExtract();

  const handleFileDrop = useCallback(async (paths: string[]) => {
    if (paths[0]) loadFile(paths[0]);
  }, [loadFile]);

  const handleChooseFile = useCallback(async () => {
    try {
      const result = await openDialog({
        multiple: false,
        filters: [{ name: 'Media', extensions: ['mp4','mkv','avi','mov','webm','flv','ts','m4v'] }],
      });
      if (result && typeof result === 'string') loadFile(result);
    } catch (err) {
      console.error('[ExtractTab] open dialog error:', err);
    }
  }, [loadFile]);

  const handleChooseOutputDir = useCallback(async () => {
    try {
      const result = await openDialog({ directory: true, multiple: false });
      if (result && typeof result === 'string') setOutputDir(result);
    } catch (err) {
      console.error('[ExtractTab] dir dialog error:', err);
    }
  }, [setOutputDir]);

  const isRunning = job.status === 'running';
  const isComplete = job.status === 'complete';
  const hasError = job.status === 'error';
  const selectedCount = selections.filter((s) => s.selected).length;

  const { reset: resetStore } = useExtractStore();

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      {/* ── ファイル選択エリア ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-4 cursor-pointer transition-colors"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
        onClick={handleChooseFile}
      >
        {probeState === 'loading' ? (
          <Loader2 className="h-5 w-5 animate-spin shrink-0" style={{ color: 'var(--accent-cyan)' }} />
        ) : (
          <FolderOpen className="h-5 w-5 shrink-0" style={{ color: 'var(--accent-cyan)' }} />
        )}
        <span className="flex-1 truncate text-sm" style={{ color: filePath ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {filePath ? filePath.split(/[/\\]/).pop() : t('dropzone')}
        </span>
        {filePath && (
          <button
            onClick={(e) => { e.stopPropagation(); resetStore(); }}
            className="ml-1 rounded p-1 transition-colors hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        )}
      </div>

      {/* Error */}
      {probeState === 'error' && probeError && (
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{ backgroundColor: 'rgba(239,71,111,0.08)', border: '0.5px solid var(--status-error)' }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--status-error)' }} />
          <p className="flex-1 text-sm" style={{ color: 'var(--status-error)' }}>{probeError}</p>
        </div>
      )}

      {/* Stream list */}
      <AnimatePresence>
        {probeState === 'ready' && mediaInfo && (
          <motion.div {...slideUp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('streams')} ({mediaInfo.streams.length})
              </p>

              {mediaInfo.streams
                .filter((s) => s.streamType !== 'data')
                .map((stream, i) => {
                  const sel = selections.find((s) => s.streamIndex === stream.index);
                  if (!sel) return null;

                  return (
                    <motion.div
                      key={stream.index}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex flex-col gap-2 rounded-xl p-4"
                      style={{
                        backgroundColor: sel.selected ? 'rgba(6,214,160,0.04)' : 'var(--bg-secondary)',
                        border: `0.5px solid ${sel.selected ? 'rgba(6,214,160,0.3)' : 'var(--border-default)'}`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => updateSelection(
                            selections.indexOf(sel),
                            { selected: !sel.selected },
                          )}
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded"
                          style={{
                            backgroundColor: sel.selected ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                            border: `1px solid ${sel.selected ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
                          }}
                        >
                          {sel.selected && (
                            <svg viewBox="0 0 8 8" width="8" height="8" fill="none">
                              <path d="M1 4l2 2 4-4" stroke="var(--bg-primary)" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                          )}
                        </button>

                        <StreamIcon type={stream.streamType} />

                        <div className="flex flex-1 min-w-0 flex-col">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            Stream #{stream.index} &ndash; {
                              stream.streamType === 'video' ? t('video') :
                              stream.streamType === 'audio' ? t('audio') :
                              stream.streamType === 'subtitle' ? t('subtitle') : 'data'
                            }
                            {stream.title && ` (${stream.title})`}
                          </span>
                          <span className="truncate text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {streamDetail(stream)}
                          </span>
                        </div>

                        {/* Format selector */}
                        {sel.selected && (
                          <div className="shrink-0 w-28">
                            <Select
                              value={sel.outputFormat}
                              options={formatOptionsFor(stream.streamType)}
                              onChange={(e) =>
                                updateSelection(selections.indexOf(sel), { outputFormat: e.target.value })
                              }
                            />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
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

            {/* Execute button */}
            <Button
              variant="primary"
              size="lg"
              icon={<Layers className="h-4 w-4" />}
              loading={isRunning}
              disabled={isRunning || selectedCount === 0}
              onClick={executeExtract}
            >
              {t('execute')} ({selectedCount})
            </Button>

            {/* Progress */}
            <AnimatePresence>
              {(isRunning || isComplete || hasError) && (
                <motion.div
                  {...slideUp}
                  className="flex flex-col gap-3 rounded-xl p-4"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: `0.5px solid ${hasError ? 'var(--status-error)' : isComplete ? 'var(--status-success)' : 'var(--border-default)'}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    {isComplete && <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--status-success)' }} />}
                    {hasError && <AlertCircle className="h-4 w-4" style={{ color: 'var(--status-error)' }} />}
                    {isRunning && <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent-cyan)' }} />}
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {isComplete ? t('complete') : hasError ? job.error : t('running')}
                    </span>
                  </div>

                  {(isRunning || isComplete) && (
                    <ProgressBar value={job.percent} animated={isRunning} />
                  )}

                  {isRunning && (
                    <div className="flex gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      <span>{job.percent.toFixed(1)}%</span>
                      {job.speed && <span>{job.speed}</span>}
                    </div>
                  )}

                  {isComplete && job.outputDir && (
                    <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {job.outputDir}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
