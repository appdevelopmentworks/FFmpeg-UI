'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Scissors,
  FolderOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Zap,
  Target,
} from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/Button';
import { DropZone } from '@/components/ui/DropZone';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Input } from '@/components/ui/Input';
import { useTrim } from '@/hooks/useTrim';
import { Timeline, secondsToHMS } from '@/components/shared/Timeline';
import { fadeIn, slideUp } from '@/lib/animations';

// ── Helpers ────────────────────────────────────────────────────────────────────

function secondsToDisplay(s: number): string {
  return secondsToHMS(s);
}

function parseTimeInput(s: string): number | null {
  // Accept HH:MM:SS.mmm or MM:SS.mmm or raw seconds
  const parts = s.split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]);
    const m = parseFloat(parts[1]);
    const sec = parseFloat(parts[2]);
    if (isNaN(h) || isNaN(m) || isNaN(sec)) return null;
    return h * 3600 + m * 60 + sec;
  }
  if (parts.length === 2) {
    const m = parseFloat(parts[0]);
    const sec = parseFloat(parts[1]);
    if (isNaN(m) || isNaN(sec)) return null;
    return m * 60 + sec;
  }
  const v = parseFloat(s);
  return isNaN(v) ? null : v;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TrimTab() {
  const t = useTranslations('trim');
  const tc = useTranslations('common');

  const {
    filePath, mediaInfo, thumbnails, probeState, probeError,
    startTime, endTime, accurate, outputPath, job,
    setStartTime, setEndTime, setAccurate, setOutputPath,
    loadFile, executeTrim,
  } = useTrim();

  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

  // Sync store → inputs
  useEffect(() => { setStartInput(secondsToDisplay(startTime)); }, [startTime]);
  useEffect(() => { setEndInput(secondsToDisplay(endTime)); }, [endTime]);

  const handleFileDrop = useCallback(async (paths: string[]) => {
    if (paths[0]) loadFile(paths[0]);
  }, [loadFile]);

  const handleChooseFile = useCallback(async () => {
    try {
      const result = await openDialog({
        multiple: false,
        filters: [{ name: 'Media', extensions: ['mp4','mkv','avi','mov','webm','flv','ts','m4v','wmv'] }],
      });
      if (result && typeof result === 'string') loadFile(result);
    } catch (err) {
      console.error('[TrimTab] open dialog error:', err);
    }
  }, [loadFile]);

  const handleChooseOutput = useCallback(async () => {
    try {
      const result = await openDialog({
        multiple: false,
        filters: [{ name: 'Media', extensions: ['mp4','mkv','avi','mov','webm'] }],
      });
      if (result && typeof result === 'string') setOutputPath(result);
    } catch (err) {
      console.error('[TrimTab] save dialog error:', err);
    }
  }, [setOutputPath]);

  const handleStartBlur = useCallback(() => {
    const t = parseTimeInput(startInput);
    if (t !== null) setStartTime(Math.max(0, Math.min(t, endTime - 0.1)));
    else setStartInput(secondsToDisplay(startTime));
  }, [startInput, startTime, endTime, setStartTime]);

  const handleEndBlur = useCallback(() => {
    const t = parseTimeInput(endInput);
    if (t !== null && mediaInfo) setEndTime(Math.max(startTime + 0.1, Math.min(t, mediaInfo.duration)));
    else setEndInput(secondsToDisplay(endTime));
  }, [endInput, startTime, endTime, mediaInfo, setEndTime]);

  const isRunning = job.status === 'running';
  const isComplete = job.status === 'complete';
  const hasError = job.status === 'error';

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      {/* Drop zone (compact when file loaded) */}
      {probeState === 'idle' || probeState === 'error' ? (
        <DropZone
          multiple={false}
          onFileDrop={handleFileDrop}
          accept={['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.ts', '.m4v']}
          label={tc('dragOrClick')}
          sublabel="mp4, mkv, avi, mov, webm, flv, ts"
          className="py-8"
        />
      ) : (
        <motion.div
          {...fadeIn}
          className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer"
          style={{ backgroundColor: 'var(--bg-secondary)', border: '0.5px solid var(--border-default)' }}
          onClick={handleChooseFile}
          whileHover={{ opacity: 0.85 }}
        >
          <FolderOpen className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-cyan)' }} />
          <span className="flex-1 truncate text-sm" style={{ color: 'var(--text-primary)' }}>
            {filePath.split(/[/\\]/).pop()}
          </span>
          {mediaInfo && (
            <span className="text-xs shrink-0" style={{ color: 'var(--text-tertiary)' }}>
              {secondsToDisplay(mediaInfo.duration).slice(0, 5)} &nbsp; {formatBytes(mediaInfo.size)}
            </span>
          )}
        </motion.div>
      )}

      {/* Error */}
      <AnimatePresence>
        {probeState === 'error' && probeError && (
          <motion.div
            {...fadeIn}
            className="flex items-start gap-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: 'rgba(239,71,111,0.08)', border: '0.5px solid var(--status-error)' }}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--status-error)' }} />
            <p className="text-sm" style={{ color: 'var(--status-error)' }}>{probeError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      <AnimatePresence>
        {probeState === 'loading' && (
          <motion.div {...fadeIn} className="flex items-center justify-center gap-2 py-6">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--accent-cyan)' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{tc('loading')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <AnimatePresence>
        {probeState === 'ready' && mediaInfo && (
          <motion.div {...slideUp} className="flex flex-col gap-4">
            {/* Timeline */}
            <Timeline
              duration={mediaInfo.duration}
              startTime={startTime}
              endTime={endTime}
              thumbnails={thumbnails}
              onStartChange={setStartTime}
              onEndChange={setEndTime}
            />

            {/* Time inputs */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('start')}
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                onBlur={handleStartBlur}
                onKeyDown={(e) => e.key === 'Enter' && handleStartBlur()}
                style={{ fontFamily: 'var(--font-jetbrains, monospace)' }}
              />
              <Input
                label={t('end')}
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                onBlur={handleEndBlur}
                onKeyDown={(e) => e.key === 'Enter' && handleEndBlur()}
                style={{ fontFamily: 'var(--font-jetbrains, monospace)' }}
              />
            </div>

            {/* Cut mode */}
            <div
              className="flex flex-col gap-2 rounded-xl p-4"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '0.5px solid var(--border-default)' }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('cutMode')}</p>
              {[
                { value: false, icon: <Zap className="h-3.5 w-3.5" />, label: t('fastCut') },
                { value: true,  icon: <Target className="h-3.5 w-3.5" />, label: t('accurateCut') },
              ].map(({ value, icon, label }) => (
                <button
                  key={String(value)}
                  onClick={() => setAccurate(value)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors"
                  style={{
                    backgroundColor: accurate === value ? 'rgba(6,214,160,0.08)' : 'transparent',
                    color: accurate === value ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    border: `0.5px solid ${accurate === value ? 'var(--accent-cyan)' : 'transparent'}`,
                  }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {/* Output path */}
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

            {/* Execute button */}
            <Button
              variant="primary"
              size="lg"
              icon={<Scissors className="h-4 w-4" />}
              loading={isRunning}
              disabled={isRunning || !outputPath}
              onClick={executeTrim}
            >
              {t('execute')}
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isComplete && <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--status-success)' }} />}
                      {hasError && <AlertCircle className="h-4 w-4" style={{ color: 'var(--status-error)' }} />}
                      {isRunning && <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent-cyan)' }} />}
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {isComplete ? t('complete') : hasError ? job.error : t('running')}
                      </span>
                    </div>
                    {isRunning && (
                      <button onClick={() => {}}>
                        <X className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                      </button>
                    )}
                  </div>

                  {(isRunning || isComplete) && (
                    <ProgressBar value={job.percent} animated={isRunning} />
                  )}

                  {isRunning && (
                    <div className="flex gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      <span>{job.percent.toFixed(1)}%</span>
                      {job.speed && <span>{job.speed}</span>}
                      {job.eta && <span>{tc('remaining')} {job.eta}</span>}
                    </div>
                  )}

                  {isComplete && job.outputPath && (
                    <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {job.outputPath}
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
