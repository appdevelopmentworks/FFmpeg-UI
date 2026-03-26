'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio,
  Loader2,
  Square,
  FolderOpen,
  AlertCircle,
  Wifi,
  WifiOff,
  ChevronDown,
  Clock,
} from 'lucide-react';
import { useStreamStore, type StreamProtocol } from '@/stores/streamStore';
import { probeStream, startRecording, stopRecording, openFileDialog } from '@/lib/tauri/commands';

const PROTOCOLS: { value: StreamProtocol; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'rtmp', label: 'RTMP' },
  { value: 'hls', label: 'HLS' },
  { value: 'dash', label: 'DASH' },
  { value: 'http', label: 'HTTP' },
];

const OUTPUT_FORMATS = ['mp4', 'mkv', 'ts', 'flv', 'mov'];

const DURATION_PRESETS = [
  { label: '—', value: 0 },
  { label: '30分', value: 1800 },
  { label: '1時間', value: 3600 },
  { label: '2時間', value: 7200 },
  { label: '6時間', value: 21600 },
];

function formatBitrate(bps?: number): string {
  if (!bps) return '—';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  return `${(bps / 1000).toFixed(0)} kbps`;
}

export function StreamTab() {
  const t = useTranslations('stream');
  const tCommon = useTranslations('common');

  const {
    url, protocol, status, streamInfo, error, jobId,
    outputFormat, outputDir, durationLimit,
    setUrl, setProtocol, setStatus, setStreamInfo, setError,
    setJobId, setOutputFormat, setOutputDir, setDurationLimit,
    reset,
  } = useStreamStore();

  const [showSettings, setShowSettings] = useState(true);

  const isConnected = status === 'connected' || status === 'recording';
  const isRecording = status === 'recording';
  const isBusy = status === 'connecting' || status === 'recording';

  // ── Connect ───────────────────────────────────────────────────────────────

  const handleConnect = async () => {
    if (!url.trim()) return;
    setError(null);
    setStatus('connecting');
    try {
      const info = await probeStream(url.trim());
      const videoStream = info.streams.find((s) => s.streamType === 'video');
      const audioStream = info.streams.find((s) => s.streamType === 'audio');
      setStreamInfo({
        url: url.trim(),
        videoCodec: videoStream?.codecName,
        audioCodec: audioStream?.codecName,
        width: videoStream?.width,
        height: videoStream?.height,
        fps: videoStream?.fps,
        bitrate: audioStream?.bitRate,
      });
      setStatus('connected');
    } catch (err) {
      setError(String(err));
      setStatus('error');
    }
  };

  const handleDisconnect = () => {
    reset();
  };

  // ── Recording ─────────────────────────────────────────────────────────────

  const handleStartRecording = async () => {
    if (!url.trim()) return;
    setError(null);
    try {
      const outName = `stream_${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const outPath = outputDir
        ? `${outputDir}/${outName}.${outputFormat}`
        : `${outName}.${outputFormat}`;

      const id = await startRecording({
        url: url.trim(),
        outputPath: outPath,
        format: outputFormat,
        durationLimit: durationLimit > 0 ? durationLimit : undefined,
      });
      setJobId(id);
      setStatus('recording');
    } catch (err) {
      setError(String(err));
    }
  };

  const handleStopRecording = async () => {
    if (!jobId) return;
    try {
      await stopRecording(jobId);
      setJobId(null);
      setStatus('connected');
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSelectOutputDir = async () => {
    try {
      const paths = await openFileDialog(tCommon('outputDir'), [], false, true);
      if (paths && paths.length > 0) setOutputDir(paths[0]);
    } catch (err) {
      console.error('Dir dialog error:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isBusy) handleConnect();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* URL Input Row */}
      <div
        className="flex items-center gap-2 rounded-xl px-4 py-3"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: `0.5px solid ${error ? 'var(--status-error)' : isConnected ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
        }}
      >
        {/* Protocol selector */}
        <select
          value={protocol}
          onChange={(e) => setProtocol(e.target.value as StreamProtocol)}
          disabled={isBusy}
          className="shrink-0 rounded-lg px-2 py-1 text-xs outline-none"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '0.5px solid var(--border-default)',
          }}
        >
          {PROTOCOLS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Status icon */}
        {status === 'connecting' ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: 'var(--accent-cyan)' }} />
        ) : isConnected ? (
          <Wifi className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-cyan)' }} />
        ) : error ? (
          <WifiOff className="h-4 w-4 shrink-0" style={{ color: 'var(--status-error)' }} />
        ) : (
          <Radio className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
        )}

        {/* URL input */}
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('urlPlaceholder')}
          disabled={isBusy}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--text-primary)' }}
        />

        {/* Connect / Disconnect button */}
        {isConnected ? (
          <button
            onClick={handleDisconnect}
            disabled={isRecording}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '0.5px solid var(--border-default)',
            }}
          >
            {t('disconnect')}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={!url.trim() || status === 'connecting'}
            className="shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium transition-all"
            style={{
              backgroundColor: url.trim() ? 'color-mix(in srgb, var(--accent-cyan) 15%, transparent)' : 'var(--bg-tertiary)',
              color: url.trim() ? 'var(--accent-cyan)' : 'var(--text-tertiary)',
              border: url.trim() ? '0.5px solid var(--accent-cyan)' : '0.5px solid var(--border-default)',
            }}
          >
            {status === 'connecting' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('connect')}
          </button>
        )}
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{
              backgroundColor: 'rgba(239,71,111,0.1)',
              border: '0.5px solid var(--status-error)',
              color: 'var(--status-error)',
            }}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Center: Stream info / Preview */}
        <div
          className="flex flex-1 flex-col rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: `0.5px solid ${isRecording ? 'var(--status-error)' : 'var(--border-default)'}`,
          }}
        >
          {/* Recording indicator */}
          {isRecording && (
            <div
              className="flex items-center gap-2 px-4 py-2"
              style={{ backgroundColor: 'rgba(239,71,111,0.12)', borderBottom: '0.5px solid var(--status-error)' }}
            >
              <motion.span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: 'var(--status-error)' }}
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
              <span className="text-xs font-medium" style={{ color: 'var(--status-error)' }}>
                REC
              </span>
            </div>
          )}

          {/* Stream info grid */}
          {streamInfo ? (
            <div className="p-4 grid grid-cols-2 gap-3">
              {[
                { label: t('protocol'), value: protocol.toUpperCase() },
                { label: 'Video', value: streamInfo.videoCodec ?? '—' },
                { label: 'Audio', value: streamInfo.audioCodec ?? '—' },
                {
                  label: '解像度',
                  value: streamInfo.width && streamInfo.height
                    ? `${streamInfo.width}×${streamInfo.height}`
                    : '—',
                },
                { label: 'FPS', value: streamInfo.fps ? `${streamInfo.fps}` : '—' },
                { label: 'Bitrate', value: formatBitrate(streamInfo.bitrate) },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    {label}
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Radio className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('preview')}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('connectHint')}
              </p>
            </div>
          )}
        </div>

        {/* Right: Recording Settings */}
        <div
          className="flex w-64 shrink-0 flex-col rounded-xl"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '0.5px solid var(--border-default)',
          }}
        >
          {/* Settings header (collapsible) */}
          <button
            className="flex items-center gap-2 px-3 py-2.5 w-full"
            style={{ borderBottom: '0.5px solid var(--border-default)' }}
            onClick={() => setShowSettings(!showSettings)}
          >
            <span className="flex-1 text-xs font-medium text-left" style={{ color: 'var(--text-secondary)' }}>
              {t('recordSettings')}
            </span>
            <motion.span animate={{ rotate: showSettings ? 0 : -90 }}>
              <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-col gap-4 overflow-hidden p-3"
              >
                {/* Output Format */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {t('outputFormat')}
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {OUTPUT_FORMATS.map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setOutputFormat(fmt)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium transition-all"
                        style={{
                          backgroundColor: outputFormat === fmt
                            ? 'color-mix(in srgb, var(--accent-cyan) 15%, transparent)'
                            : 'var(--bg-tertiary)',
                          color: outputFormat === fmt ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                          border: outputFormat === fmt
                            ? '0.5px solid var(--accent-cyan)'
                            : '0.5px solid var(--border-default)',
                        }}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration Limit */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    <Clock className="h-3 w-3" />
                    {t('durationLimit')}
                  </label>
                  <select
                    value={durationLimit}
                    onChange={(e) => setDurationLimit(Number(e.target.value))}
                    className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '0.5px solid var(--border-default)',
                    }}
                  >
                    {DURATION_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.value === 0 ? t('noLimit') : p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Output Dir */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {tCommon('outputDir')}
                  </label>
                  <div className="flex gap-1.5">
                    <div
                      className="flex-1 truncate rounded-lg px-2 py-1.5 text-xs"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: outputDir ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        border: '0.5px solid var(--border-default)',
                      }}
                      title={outputDir}
                    >
                      {outputDir || '—'}
                    </div>
                    <button
                      onClick={handleSelectOutputDir}
                      className="shrink-0 rounded-lg px-2 py-1.5 transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '0.5px solid var(--border-default)',
                      }}
                    >
                      <FolderOpen className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Record / Stop buttons */}
          <div className="mt-auto p-3 space-y-2" style={{ borderTop: '0.5px solid var(--border-default)' }}>
            {isRecording ? (
              <button
                onClick={handleStopRecording}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all"
                style={{
                  backgroundColor: 'rgba(239,71,111,0.15)',
                  color: 'var(--status-error)',
                  border: '0.5px solid var(--status-error)',
                }}
              >
                <Square className="h-4 w-4" />
                {t('stopRecording')}
              </button>
            ) : (
              <button
                onClick={handleStartRecording}
                disabled={!isConnected}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all"
                style={{
                  backgroundColor: isConnected
                    ? 'rgba(239,71,111,0.15)'
                    : 'var(--bg-tertiary)',
                  color: isConnected ? 'var(--status-error)' : 'var(--text-tertiary)',
                  border: isConnected
                    ? '0.5px solid var(--status-error)'
                    : '0.5px solid var(--border-default)',
                }}
              >
                <motion.span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: isConnected ? 'var(--status-error)' : 'var(--text-tertiary)' }}
                  animate={isConnected ? { opacity: [1, 0.4, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
                {t('startRecording')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
