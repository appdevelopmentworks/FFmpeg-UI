'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, RefreshCw, Zap, X } from 'lucide-react';

import { backdropVariants, modalVariants } from '@/lib/animations';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import { useSetup } from '@/hooks/useSetup';
import type { ToolStatus } from '@/stores/setupStore';

// ── 個別ツール行 ───────────────────────────────────────────────────────────────

interface ToolRowProps {
  name:    string;
  status:  ToolStatus;
  onRetry: () => void;
}

function ToolRow({ name, status, onRetry }: ToolRowProps) {
  const t = useTranslations('setup');
  const { phase, progress, version, error } = status;

  const isComplete   = phase === 'complete';
  const isError      = phase === 'error';
  const isDownloading = phase === 'downloading';
  const isIdle       = phase === 'idle';

  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        border: '0.5px solid var(--border-default)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle size={16} style={{ color: 'var(--status-success)' }} />
          ) : isError ? (
            <AlertCircle size={16} style={{ color: 'var(--status-error)' }} />
          ) : isDownloading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw size={16} style={{ color: 'var(--accent-cyan)' }} />
            </motion.div>
          ) : (
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '1.5px solid var(--border-hover)' }}
            />
          )}

          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {name}
          </span>

          {isComplete && version && (
            <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
              v{version}
            </span>
          )}
        </div>

        {/* Status label */}
        <div className="flex items-center gap-2">
          {isComplete && (
            <span className="text-xs" style={{ color: 'var(--status-success)' }}>
              {t('complete')}
            </span>
          )}
          {isIdle && (
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('waiting')}
            </span>
          )}
          {isError && (
            <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={onRetry}>
              {t('retryBtn')}
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <AnimatePresence>
        {isDownloading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ProgressBar
              value={progress.percent}
              animated
              showValue={false}
              height={3}
              className="mb-1.5"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs tabular-nums font-mono" style={{ color: 'var(--text-tertiary)' }}>
                {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
              </span>
              <span className="text-xs tabular-nums font-mono" style={{ color: 'var(--accent-cyan)' }}>
                {progress.percent.toFixed(0)}%
              </span>
            </div>
          </motion.div>
        )}

        {isComplete && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ProgressBar value={100} height={3} showValue={false} />
          </motion.div>
        )}

        {isError && (
          <motion.p
            className="text-xs mt-1"
            style={{ color: 'var(--status-error)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── メインダイアログ ──────────────────────────────────────────────────────────

export function SetupDialog() {
  const t = useTranslations('setup');
  const { phase, ffmpegStatus, ytdlpStatus, checkAndSetup, retry, skip } = useSetup();

  // マウント時にバイナリチェックを開始
  useEffect(() => {
    checkAndSetup();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回マウントのみ

  const isOpen = phase === 'checking' || phase === 'downloading';

  const bothComplete =
    ffmpegStatus.phase === 'complete' && ytdlpStatus.phase === 'complete';

  const hasError =
    ffmpegStatus.phase === 'error' || ytdlpStatus.phase === 'error';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="setup-backdrop"
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          />

          {/* Panel */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="setup-modal"
              className="w-full max-w-md pointer-events-auto rounded-2xl overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '0.5px solid var(--border-default)',
                boxShadow: 'var(--shadow-lg)',
              }}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4">
                {/* Logo + Title */}
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{ backgroundColor: 'var(--accent-cyan-dim)' }}
                  >
                    <Zap size={20} style={{ color: 'var(--accent-cyan)' }} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                      FFmpeg-UI {t('title')}
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {t('description')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 pb-4 flex flex-col gap-3">
                <ToolRow
                  name="FFmpeg"
                  status={ffmpegStatus}
                  onRetry={() => retry('ffmpeg')}
                />
                <ToolRow
                  name="yt-dlp"
                  status={ytdlpStatus}
                  onRetry={() => retry('ytdlp')}
                />

                {/* Notes */}
                <div className="flex flex-col gap-1 pt-1">
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    ※ {t('githubNote')}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    ※ {t('sha256Note')}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderTop: '0.5px solid var(--border-default)' }}
              >
                {bothComplete ? (
                  <motion.p
                    className="text-sm font-medium"
                    style={{ color: 'var(--status-success)' }}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {t('completeMsg')}
                  </motion.p>
                ) : hasError ? (
                  <p className="text-xs" style={{ color: 'var(--status-warning)' }}>
                    {t('errorMsg')}
                  </p>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('downloading')}
                  </p>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  icon={<X size={14} />}
                  onClick={skip}
                  style={{ marginLeft: 'auto' }}
                >
                  {t('skip')}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
