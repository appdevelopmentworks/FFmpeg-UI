'use client';

import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, Pause, Play, FolderOpen } from 'lucide-react';
import { useJobStore } from '@/stores/jobStore';
import { useUIStore } from '@/stores/uiStore';
import type { Job } from '@/types/job';

function JobStatusIcon({ status }: { status: Job['status'] }) {
  switch (status) {
    case 'completed':
      return <span style={{ color: 'var(--status-success)' }}>✅</span>;
    case 'running':
      return <span style={{ color: 'var(--accent-cyan)' }}>🔄</span>;
    case 'pending':
      return <span style={{ color: 'var(--text-tertiary)' }}>⏳</span>;
    case 'paused':
      return <span style={{ color: 'var(--status-warning)' }}>⏸</span>;
    case 'failed':
      return <span style={{ color: 'var(--status-error)' }}>❌</span>;
    case 'cancelled':
      return <span style={{ color: 'var(--text-tertiary)' }}>🚫</span>;
    default:
      return null;
  }
}

function JobRow({ job }: { job: Job }) {
  const t = useTranslations('jobs');
  const cancelJob = useJobStore((s) => s.cancelJob);
  const pauseJob = useJobStore((s) => s.pauseJob);
  const resumeJob = useJobStore((s) => s.resumeJob);

  const percent = job.progress?.percent ?? 0;
  const filename = job.inputPath.split(/[\\/]/).pop() ?? job.inputPath;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-xs transition-colors"
      style={{ borderBottom: '0.5px solid var(--border-default)' }}
    >
      <JobStatusIcon status={job.status} />

      <div className="min-w-0 flex-1">
        <div className="truncate" style={{ color: 'var(--text-primary)' }}>
          {filename}
        </div>
        {job.status === 'running' && job.progress && (
          <div className="mt-1 flex items-center gap-2">
            {/* Progress bar */}
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
            {job.progress.speed && (
              <span style={{ color: 'var(--text-tertiary)' }}>
                {job.progress.speed}
              </span>
            )}
            {job.progress.eta && (
              <span style={{ color: 'var(--text-tertiary)' }}>
                {t('remaining')} {job.progress.eta}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Job status label */}
      <span style={{ color: 'var(--text-tertiary)', minWidth: 40 }}>
        {job.status === 'completed' && job.completedAt ? '完了' : ''}
        {job.status === 'pending' ? t('pending') : ''}
        {job.status === 'failed' ? t('failed') : ''}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {job.status === 'running' && (
          <button
            onClick={() => pauseJob(job.id)}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title={t('pause')}
          >
            <Pause className="h-3 w-3" />
          </button>
        )}
        {job.status === 'paused' && (
          <button
            onClick={() => resumeJob(job.id)}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title={t('resume')}
          >
            <Play className="h-3 w-3" />
          </button>
        )}
        {(job.status === 'running' || job.status === 'pending' || job.status === 'paused') && (
          <button
            onClick={() => cancelJob(job.id)}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors"
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

export function JobQueueFooter() {
  const t = useTranslations('jobs');
  const jobs = useJobStore((s) => s.jobs);
  const activeJobCount = useJobStore((s) => s.activeJobCount);
  const expanded = useUIStore((s) => s.jobQueueExpanded);
  const toggleJobQueue = useUIStore((s) => s.toggleJobQueue);

  const runningJob = jobs.find((j) => j.status === 'running');
  const completedCount = jobs.filter((j) => j.status === 'completed').length;

  return (
    <div
      className="shrink-0"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '0.5px solid var(--border-default)',
      }}
    >
      {/* Expanded job list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
            style={{ maxHeight: 240, overflowY: 'auto' }}
          >
            {jobs.length === 0 ? (
              <div
                className="px-4 py-3 text-xs"
                style={{ color: 'var(--text-tertiary)' }}
              >
                ジョブなし
              </div>
            ) : (
              jobs.map((job) => <JobRow key={job.id} job={job} />)
            )}

            {/* Footer controls */}
            {jobs.length > 0 && (
              <div
                className="flex items-center justify-between px-4 py-2 text-xs"
                style={{ borderTop: '0.5px solid var(--border-default)' }}
              >
                <span style={{ color: 'var(--text-tertiary)' }}>
                  並列処理: {activeJobCount} / {jobs.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="flex items-center gap-1 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <FolderOpen className="h-3 w-3" />
                    {t('openFolder')}
                  </button>
                  <button
                    className="transition-colors"
                    style={{ color: 'var(--status-error)' }}
                  >
                    {t('cancelAll')}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed bar (always visible) */}
      <button
        onClick={toggleJobQueue}
        className="flex h-12 w-full items-center gap-3 px-4 text-xs transition-colors"
        style={{ color: 'var(--text-secondary)' }}
      >
        <motion.div animate={{ rotate: expanded ? 0 : 180 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.div>

        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
          {t('queue')}
        </span>

        {/* Job count badge */}
        {jobs.length > 0 && (
          <span
            className="rounded px-1.5 py-0.5 text-xs"
            style={{
              backgroundColor: 'var(--accent-cyan-dim)',
              color: 'var(--accent-cyan)',
            }}
          >
            {completedCount}/{jobs.length}
          </span>
        )}

        {/* Active job progress */}
        {runningJob && runningJob.progress && (
          <>
            <div className="mx-2 h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: 'var(--accent-cyan)' }}
                animate={{ width: `${runningJob.progress.percent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span>{Math.round(runningJob.progress.percent)}%</span>
            <span style={{ color: 'var(--text-tertiary)' }}>
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
