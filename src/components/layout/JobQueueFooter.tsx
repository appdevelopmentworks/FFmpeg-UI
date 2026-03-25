'use client';

import { useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, Pause, Play, Trash2 } from 'lucide-react';
import { useJobStore } from '@/stores/jobStore';
import { useUIStore } from '@/stores/uiStore';
import type { Job } from '@/types/job';

// ── ステータスアイコン ────────────────────────────────────────────────────────

function JobStatusDot({ status }: { status: Job['status'] }) {
  const color =
    status === 'completed' ? 'var(--status-success)'
    : status === 'running'   ? 'var(--accent-cyan)'
    : status === 'pending'   ? 'var(--text-tertiary)'
    : status === 'paused'    ? 'var(--status-warning)'
    : status === 'failed'    ? 'var(--status-error)'
    :                          'var(--text-tertiary)';

  return (
    <span
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

// ── ジョブ行 ─────────────────────────────────────────────────────────────────

function JobRow({ job }: { job: Job }) {
  const t = useTranslations('jobs');
  const cancelJob = useJobStore((s) => s.cancelJob);
  const pauseJob  = useJobStore((s) => s.pauseJob);
  const resumeJob = useJobStore((s) => s.resumeJob);

  const percent  = job.progress?.percent ?? 0;
  const filename = job.inputPath.split(/[\\/]/).pop() ?? job.inputPath;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-xs"
      style={{ borderBottom: '0.5px solid var(--border-default)' }}
    >
      <JobStatusDot status={job.status} />

      <div className="min-w-0 flex-1">
        <div className="truncate" style={{ color: 'var(--text-primary)' }}>
          {filename}
        </div>

        {job.status === 'running' && (
          <div className="mt-1 flex items-center gap-2">
            <div
              className="h-1 flex-1 overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: 'var(--accent-cyan)' }}
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span style={{ color: 'var(--text-secondary)' }}>
              {Math.round(percent)}%
            </span>
            {job.progress?.speed && (
              <span style={{ color: 'var(--text-tertiary)' }}>
                {job.progress.speed}
              </span>
            )}
            {job.progress?.eta && (
              <span style={{ color: 'var(--text-tertiary)' }}>
                {t('remaining')} {job.progress.eta}
              </span>
            )}
          </div>
        )}

        {(job.status === 'failed' || job.status === 'cancelled') && job.error && (
          <div className="mt-0.5 truncate" style={{ color: 'var(--status-error)', fontSize: 10 }}>
            {job.error}
          </div>
        )}
      </div>

      {/* ステータスラベル */}
      <span className="shrink-0 text-xs" style={{ color: 'var(--text-tertiary)', minWidth: 36 }}>
        {job.status === 'pending'   && t('pending')}
        {job.status === 'failed'    && t('failed')}
        {job.status === 'cancelled' && t('cancelled')}
        {job.status === 'completed' && t('completed')}
      </span>

      {/* アクションボタン */}
      <div className="flex shrink-0 items-center gap-0.5">
        {job.status === 'running' && (
          <button
            onClick={() => pauseJob(job.id)}
            className="flex h-6 w-6 items-center justify-center rounded transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
            title={t('pause')}
          >
            <Pause className="h-3 w-3" />
          </button>
        )}
        {job.status === 'paused' && (
          <button
            onClick={() => resumeJob(job.id)}
            className="flex h-6 w-6 items-center justify-center rounded transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
            title={t('resume')}
          >
            <Play className="h-3 w-3" />
          </button>
        )}
        {(job.status === 'running' || job.status === 'pending' || job.status === 'paused') && (
          <button
            onClick={() => cancelJob(job.id)}
            className="flex h-6 w-6 items-center justify-center rounded transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
            title={t('cancel')}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export function JobQueueFooter() {
  const t = useTranslations('jobs');

  const jobs           = useJobStore((s) => s.jobs);
  const activeJobCount = useJobStore((s) => s.activeJobCount);
  const cancelJob      = useJobStore((s) => s.cancelJob);
  const clearCompleted = useJobStore((s) => s.clearCompleted);
  const initListeners  = useJobStore((s) => s.initListeners);

  const expanded       = useUIStore((s) => s.jobQueueExpanded);
  const toggleJobQueue = useUIStore((s) => s.toggleJobQueue);

  // Rust イベントリスナー初期化
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    initListeners().then((fn) => { cleanup = fn; }).catch(() => {});
    return () => { cleanup?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancelAll = useCallback(async () => {
    const active = jobs.filter(
      (j) => j.status === 'running' || j.status === 'pending' || j.status === 'paused',
    );
    for (const job of active) {
      await cancelJob(job.id);
    }
  }, [jobs, cancelJob]);

  const runningJob      = jobs.find((j) => j.status === 'running');
  const completedCount  = jobs.filter((j) => j.status === 'completed').length;
  const hasCompleted    = jobs.some((j) =>
    j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled',
  );

  return (
    <div
      className="shrink-0"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '0.5px solid var(--border-default)',
      }}
    >
      {/* 展開リスト */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ maxHeight: 240, overflowY: 'auto' }}
          >
            {jobs.length === 0 ? (
              <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('noJobs')}
              </div>
            ) : (
              jobs.map((job) => <JobRow key={job.id} job={job} />)
            )}

            {jobs.length > 0 && (
              <div
                className="flex items-center justify-between px-4 py-2 text-xs"
                style={{ borderTop: '0.5px solid var(--border-default)' }}
              >
                <span style={{ color: 'var(--text-tertiary)' }}>
                  {activeJobCount} / {jobs.length} {t('active')}
                </span>
                <div className="flex items-center gap-3">
                  {hasCompleted && (
                    <button
                      onClick={clearCompleted}
                      className="flex items-center gap-1 transition-opacity hover:opacity-70"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Trash2 className="h-3 w-3" />
                      {t('clearCompleted')}
                    </button>
                  )}
                  {activeJobCount > 0 && (
                    <button
                      onClick={handleCancelAll}
                      className="transition-opacity hover:opacity-70"
                      style={{ color: 'var(--status-error)' }}
                    >
                      {t('cancelAll')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 折り畳みバー (常時表示) */}
      <button
        onClick={toggleJobQueue}
        className="flex h-10 w-full items-center gap-3 px-4 text-xs transition-opacity hover:opacity-80"
        style={{ color: 'var(--text-secondary)' }}
      >
        <motion.div animate={{ rotate: expanded ? 0 : 180 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.div>

        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
          {t('queue')}
        </span>

        {/* ジョブ数バッジ */}
        {jobs.length > 0 && (
          <span
            className="rounded px-1.5 py-0.5 text-xs"
            style={{
              backgroundColor: 'rgba(6,214,160,0.12)',
              color: 'var(--accent-cyan)',
            }}
          >
            {completedCount}/{jobs.length}
          </span>
        )}

        {/* 実行中ジョブの進捗 */}
        {runningJob && runningJob.progress && (
          <>
            <div
              className="mx-2 h-1 flex-1 overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: 'var(--accent-cyan)' }}
                animate={{ width: `${runningJob.progress.percent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span>{Math.round(runningJob.progress.percent)}%</span>
            <span className="max-w-32 truncate" style={{ color: 'var(--text-tertiary)' }}>
              {runningJob.inputPath.split(/[\\/]/).pop()}
            </span>
            {runningJob.progress.eta && (
              <span style={{ color: 'var(--text-tertiary)' }}>
                {t('remaining')} {runningJob.progress.eta}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
