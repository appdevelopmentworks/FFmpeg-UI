'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sun,
  Moon,
  Monitor,
  FolderOpen,
  Sliders,
  Wrench,
  Database,
  Bell,
  Languages,
  ChevronRight,
  RotateCcw,
  Download,
  Check,
} from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  openFileDialog,
  checkUpdates,
  resetSettings,
  checkBinaries,
  downloadBinary,
  type InstallableTool,
} from '@/lib/tauri/commands';
import type { ThemeMode, AppLocale, BinaryStatus } from '@/types/settings';
import { onSetupProgress } from '@/lib/tauri/events';
import { AI_UPSCALE_MODELS } from '@/lib/ffmpeg/presets';

type SettingsSection = 'general' | 'output' | 'performance' | 'tools' | 'data';

/**
 * download_binary を実行し、インストール状態を追跡する。
 * 完了/失敗は invoke の結果で判定し、進捗だけ setup:download-progress イベントから受け取る。
 */
function useBinaryInstall(tool: InstallableTool, onComplete: () => void) {
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!installing) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    onSetupProgress((p) => {
      if (p.tool === tool) setProgress(p.percent);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [installing, tool]);

  const install = async () => {
    setError(null);
    setProgress(0);
    setInstalling(true);
    try {
      await downloadBinary(tool);
      setProgress(100);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstalling(false);
    }
  };

  return { installing, progress, error, install };
}

/** 追加 AI 超解像モデル 1 件分の行（ダウンロードボタン・ライセンス表示） */
function AiModelRow({
  model,
  installed,
  onInstalled,
}: {
  model: (typeof AI_UPSCALE_MODELS)[number];
  installed: boolean;
  onInstalled: () => void;
}) {
  const tConvert = useTranslations('convert');
  const tSetup = useTranslations('setup');
  const { installing, progress, error, install } = useBinaryInstall(`model:${model.id}`, onInstalled);

  return (
    <div className="space-y-1 pt-2" style={{ borderTop: '0.5px solid var(--border-default)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-primary)' }}>
            {tConvert(model.labelKey)}
            <span
              className="rounded px-1 text-[10px]"
              style={{
                color: model.commercialOk ? 'var(--status-success)' : 'var(--status-warning)',
                border: '0.5px solid currentColor',
              }}
            >
              {model.commercialOk ? tSetup('licenseCommercialOk') : tSetup('licenseNonCommercial')}
            </span>
          </p>
          {model.descKey && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {tConvert(model.descKey)}
            </p>
          )}
        </div>
        {installed ? (
          <span
            className="flex items-center gap-1 text-xs whitespace-nowrap"
            style={{ color: 'var(--status-success)' }}
          >
            <Check className="h-3 w-3" /> {tSetup('realesrganInstalled')}
          </span>
        ) : (
          <button
            onClick={install}
            disabled={installing}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all whitespace-nowrap"
            style={{
              backgroundColor: installing ? 'var(--bg-tertiary)' : 'var(--accent-cyan-dim)',
              color: installing ? 'var(--text-tertiary)' : 'var(--accent-cyan)',
              border: '0.5px solid var(--border-default)',
              cursor: installing ? 'wait' : 'pointer',
            }}
          >
            {installing ? (
              <>
                <span className="animate-spin">↻</span> {progress.toFixed(0)}%
              </>
            ) : (
              <>
                <Download className="h-3 w-3" /> {tSetup('aiModelDownload', { size: model.sizeMb ?? 0 })}
              </>
            )}
          </button>
        )}
      </div>
      {error && (
        <p className="text-[11px]" style={{ color: 'var(--status-error)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

const SECTIONS: { id: SettingsSection; icon: React.ReactNode; labelKey: string }[] = [
  { id: 'general', icon: <Sliders className="h-3.5 w-3.5" />, labelKey: 'general' },
  { id: 'output', icon: <FolderOpen className="h-3.5 w-3.5" />, labelKey: 'output' },
  { id: 'performance', icon: <Monitor className="h-3.5 w-3.5" />, labelKey: 'performance' },
  { id: 'tools', icon: <Wrench className="h-3.5 w-3.5" />, labelKey: 'tools' },
  { id: 'data', icon: <Database className="h-3.5 w-3.5" />, labelKey: 'data' },
];

const DUPLICATE_ACTIONS = ['overwrite', 'rename', 'skip', 'ask'] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: Props) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tSetup = useTranslations('setup');

  const store = useSettingsStore();
  const [section, setSection] = useState<SettingsSection>('general');
  const [saved, setSaved] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ ffmpegUpdate: boolean; ytdlpUpdate: boolean } | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [binaries, setBinaries] = useState<BinaryStatus | null>(null);

  const refreshBinaryStatus = async () => {
    try {
      const status = await checkBinaries();
      setBinaries(status);
    } catch {
      // Tauri 環境外
    }
  };

  // tools セクション表示時にバイナリ状態を取得
  useEffect(() => {
    if (open && section === 'tools') refreshBinaryStatus();
  }, [open, section]);

  // Load settings on open
  useEffect(() => {
    if (open && !store.isLoaded) store.load();
  }, [open, store]);

  const handleSave = async () => {
    await store.save();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = async () => {
    try {
      const defaults = await resetSettings();
      store.update(defaults);
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  const handleSelectOutputDir = async () => {
    try {
      const paths = await openFileDialog(tCommon('outputDir'), [], false, true);
      if (paths && paths.length > 0) store.update({ outputDir: paths[0] });
    } catch (err) {
      console.error('Dir dialog error:', err);
    }
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const info = await checkUpdates();
      setUpdateInfo({
        ffmpegUpdate: info.ffmpegUpdateAvailable,
        ytdlpUpdate: info.ytdlpUpdateAvailable,
      });
    } catch (err) {
      console.error('Update check failed:', err);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const realesrgan = useBinaryInstall('realesrgan', refreshBinaryStatus);
  // 更新後は最新版を再取得・比較して表示を「最新」に戻す
  const ytdlpUpdate = useBinaryInstall('ytdlp', () => {
    handleCheckUpdates();
    refreshBinaryStatus();
  });
  const deno = useBinaryInstall('deno', refreshBinaryStatus);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-x-0 top-[10%] z-50 mx-auto flex w-full max-w-2xl flex-col rounded-2xl shadow-2xl"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '0.5px solid var(--border-default)',
              maxHeight: '80vh',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '0.5px solid var(--border-default)' }}
            >
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('general')} — {t(section)}
              </h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 transition-colors hover:opacity-70"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar */}
              <div
                className="flex w-40 shrink-0 flex-col py-2"
                style={{ borderRight: '0.5px solid var(--border-default)' }}
              >
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs transition-all"
                    style={{
                      backgroundColor: section === s.id
                        ? 'color-mix(in srgb, var(--accent-cyan) 10%, transparent)'
                        : 'transparent',
                      color: section === s.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      borderRight: section === s.id ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                    }}
                  >
                    {s.icon}
                    {t(s.labelKey as Parameters<typeof t>[0])}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5">
                {section === 'general' && (
                  <div className="space-y-5">
                    {/* Theme */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {t('theme')}
                      </label>
                      <div className="flex gap-2">
                        {([
                          { value: 'dark', icon: <Moon className="h-3.5 w-3.5" />, label: t('themeDark') },
                          { value: 'light', icon: <Sun className="h-3.5 w-3.5" />, label: t('themeLight') },
                          { value: 'system', icon: <Monitor className="h-3.5 w-3.5" />, label: t('themeSystem') },
                        ] as const).map(({ value, icon, label }) => (
                          <button
                            key={value}
                            onClick={() => store.setTheme(value as ThemeMode)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all"
                            style={{
                              backgroundColor: store.theme === value
                                ? 'color-mix(in srgb, var(--accent-cyan) 15%, transparent)'
                                : 'var(--bg-tertiary)',
                              color: store.theme === value ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                              border: store.theme === value
                                ? '0.5px solid var(--accent-cyan)'
                                : '0.5px solid var(--border-default)',
                            }}
                          >
                            {icon}
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Language */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        <Languages className="h-3.5 w-3.5" />
                        {t('language')}
                      </label>
                      <div className="flex gap-2">
                        {(['ja', 'en'] as const).map((locale) => (
                          <button
                            key={locale}
                            onClick={() => store.setLocale(locale as AppLocale)}
                            className="flex-1 rounded-lg py-2 text-xs font-medium transition-all"
                            style={{
                              backgroundColor: store.locale === locale
                                ? 'color-mix(in srgb, var(--accent-cyan) 15%, transparent)'
                                : 'var(--bg-tertiary)',
                              color: store.locale === locale ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                              border: store.locale === locale
                                ? '0.5px solid var(--accent-cyan)'
                                : '0.5px solid var(--border-default)',
                            }}
                          >
                            {locale === 'ja' ? '日本語' : 'English'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notifications */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        <Bell className="h-3.5 w-3.5" />
                        {t('notifications')}
                      </label>
                      <button
                        onClick={() => store.update({ notifications: !store.notifications })}
                        className="relative h-5 w-9 rounded-full transition-colors"
                        style={{
                          backgroundColor: store.notifications ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                          border: '0.5px solid var(--border-default)',
                        }}
                      >
                        <motion.span
                          className="absolute top-0.5 h-4 w-4 rounded-full"
                          style={{ backgroundColor: '#fff' }}
                          animate={{ left: store.notifications ? '18px' : '2px' }}
                          transition={{ duration: 0.15 }}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {section === 'output' && (
                  <div className="space-y-5">
                    {/* Default output dir */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {t('defaultOutput')}
                      </label>
                      <div className="flex gap-2">
                        <div
                          className="flex-1 truncate rounded-lg px-2.5 py-2 text-xs"
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            color: store.outputDir ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            border: '0.5px solid var(--border-default)',
                          }}
                          title={store.outputDir}
                        >
                          {store.outputDir || '~/Downloads'}
                        </div>
                        <button
                          onClick={handleSelectOutputDir}
                          className="shrink-0 rounded-lg px-2.5 py-2 text-xs transition-colors hover:opacity-80"
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-secondary)',
                            border: '0.5px solid var(--border-default)',
                          }}
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Duplicate action */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {t('duplicateAction')}
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DUPLICATE_ACTIONS.map((action) => (
                          <button
                            key={action}
                            onClick={() => store.update({ duplicateAction: action })}
                            className="rounded-lg py-2 text-xs font-medium transition-all"
                            style={{
                              backgroundColor: store.duplicateAction === action
                                ? 'color-mix(in srgb, var(--accent-cyan) 15%, transparent)'
                                : 'var(--bg-tertiary)',
                              color: store.duplicateAction === action ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                              border: store.duplicateAction === action
                                ? '0.5px solid var(--accent-cyan)'
                                : '0.5px solid var(--border-default)',
                            }}
                          >
                            {t(`duplicate${action.charAt(0).toUpperCase() + action.slice(1)}` as Parameters<typeof t>[0])}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Filename template */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {tCommon('filename')}
                      </label>
                      <input
                        type="text"
                        value={store.filenameTemplate}
                        onChange={(e) => store.update({ filenameTemplate: e.target.value })}
                        placeholder="{name}_{date}"
                        className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '0.5px solid var(--border-default)',
                        }}
                      />
                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {'{name}'}, {'{date}'}, {'{format}'}, {'{resolution}'}
                      </p>
                    </div>
                  </div>
                )}

                {section === 'performance' && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="flex justify-between text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        <span>{t('parallelJobs')}</span>
                        <span style={{ color: 'var(--accent-cyan)' }}>{store.maxParallelJobs}</span>
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={16}
                        step={1}
                        value={store.maxParallelJobs}
                        onChange={(e) => store.update({ maxParallelJobs: Number(e.target.value) })}
                        className="w-full accent-[var(--accent-cyan)]"
                      />
                      <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        <span>1</span>
                        <span className="opacity-60">{t('recommendedValue')}: 2–4</span>
                        <span>16</span>
                      </div>
                    </div>
                  </div>
                )}

                {section === 'tools' && (
                  <div className="space-y-5">
                    {/* FFmpeg path */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        FFmpeg
                      </label>
                      <input
                        type="text"
                        value={store.ffmpegPath ?? ''}
                        onChange={(e) => store.update({ ffmpegPath: e.target.value || undefined })}
                        placeholder={t('autoDetect')}
                        className="w-full rounded-lg px-2.5 py-2 text-xs font-mono outline-none"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '0.5px solid var(--border-default)',
                        }}
                      />
                    </div>

                    {/* yt-dlp path */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        yt-dlp
                      </label>
                      <input
                        type="text"
                        value={store.ytdlpPath ?? ''}
                        onChange={(e) => store.update({ ytdlpPath: e.target.value || undefined })}
                        placeholder={t('autoDetect')}
                        className="w-full rounded-lg px-2.5 py-2 text-xs font-mono outline-none"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '0.5px solid var(--border-default)',
                        }}
                      />
                    </div>

                    {/* Update check */}
                    <div className="space-y-2">
                      <button
                        onClick={handleCheckUpdates}
                        disabled={checkingUpdates}
                        className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                          border: '0.5px solid var(--border-default)',
                        }}
                      >
                        {checkingUpdates
                          ? <><span className="animate-spin">↻</span> {t('checkingUpdate')}</>
                          : <><Download className="h-3.5 w-3.5" /> {t('checkUpdate')}</>
                        }
                      </button>
                      {updateInfo && (
                        <div className="space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <div className="flex items-center gap-1.5">
                            {updateInfo.ffmpegUpdate
                              ? <ChevronRight className="h-3 w-3" style={{ color: 'var(--status-warning)' }} />
                              : <Check className="h-3 w-3" style={{ color: 'var(--status-success)' }} />
                            }
                            FFmpeg: {updateInfo.ffmpegUpdate ? t('updateAvailable') : t('upToDate')}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {updateInfo.ytdlpUpdate
                                ? <ChevronRight className="h-3 w-3" style={{ color: 'var(--status-warning)' }} />
                                : <Check className="h-3 w-3" style={{ color: 'var(--status-success)' }} />
                              }
                              yt-dlp: {updateInfo.ytdlpUpdate ? t('updateAvailable') : t('upToDate')}
                            </div>
                            {updateInfo.ytdlpUpdate && (
                              <button
                                onClick={ytdlpUpdate.install}
                                disabled={ytdlpUpdate.installing}
                                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all whitespace-nowrap"
                                style={{
                                  backgroundColor: ytdlpUpdate.installing
                                    ? 'var(--bg-tertiary)'
                                    : 'var(--accent-cyan-dim)',
                                  color: ytdlpUpdate.installing
                                    ? 'var(--text-tertiary)'
                                    : 'var(--accent-cyan)',
                                  border: '0.5px solid var(--border-default)',
                                  cursor: ytdlpUpdate.installing ? 'wait' : 'pointer',
                                }}
                              >
                                {ytdlpUpdate.installing ? (
                                  <>
                                    <span className="animate-spin">↻</span> {ytdlpUpdate.progress.toFixed(0)}%
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-3 w-3" /> {t('updateNow')}
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {ytdlpUpdate.error && (
                        <p className="text-[11px]" style={{ color: 'var(--status-error)' }}>
                          {t('updateFailed')}: {ytdlpUpdate.error}
                        </p>
                      )}
                    </div>

                    {/* JS ランタイム (yt-dlp の YouTube 抽出用 / Deno) */}
                    <div
                      className="space-y-2 rounded-lg p-3"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '0.5px solid var(--border-default)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <label className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                            {tSetup('denoTitle')}
                          </label>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {tSetup('denoDescription')}
                          </p>
                        </div>
                        {binaries?.jsRuntime ? (
                          <span
                            className="flex items-center gap-1 text-xs whitespace-nowrap"
                            style={{ color: 'var(--status-success)' }}
                            title={binaries.jsRuntimePath}
                          >
                            <Check className="h-3 w-3" /> {tSetup('denoDetected', { runtime: binaries.jsRuntime })}
                          </span>
                        ) : (
                          <button
                            onClick={deno.install}
                            disabled={deno.installing || !binaries}
                            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap"
                            style={{
                              backgroundColor: deno.installing
                                ? 'var(--bg-tertiary)'
                                : 'var(--accent-cyan-dim)',
                              color: deno.installing
                                ? 'var(--text-tertiary)'
                                : 'var(--accent-cyan)',
                              border: '0.5px solid var(--border-default)',
                              cursor: deno.installing ? 'wait' : 'pointer',
                            }}
                          >
                            {deno.installing ? (
                              <>
                                <span className="animate-spin">↻</span> {deno.progress.toFixed(0)}%
                              </>
                            ) : (
                              <>
                                <Download className="h-3 w-3" /> {tSetup('denoInstall')}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      {deno.error && (
                        <p className="text-[11px]" style={{ color: 'var(--status-error)' }}>
                          {deno.error}
                        </p>
                      )}
                      {binaries && !binaries.jsRuntime && !deno.installing && (
                        <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {tSetup('denoMissingNote')}
                        </p>
                      )}
                    </div>

                    {/* Real-ESRGAN (AI Super Resolution) */}
                    <div
                      className="space-y-2 rounded-lg p-3"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '0.5px solid var(--border-default)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <label className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                            {tSetup('realesrganTitle')}
                          </label>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {tSetup('realesrganDescription')}
                          </p>
                        </div>
                        {binaries?.realesrganInstalled ? (
                          <span
                            className="flex items-center gap-1 text-xs whitespace-nowrap"
                            style={{ color: 'var(--status-success)' }}
                          >
                            <Check className="h-3 w-3" /> {tSetup('realesrganInstalled')}
                          </span>
                        ) : (
                          <button
                            onClick={realesrgan.install}
                            disabled={realesrgan.installing}
                            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap"
                            style={{
                              backgroundColor: realesrgan.installing
                                ? 'var(--bg-tertiary)'
                                : 'var(--accent-cyan-dim)',
                              color: realesrgan.installing
                                ? 'var(--text-tertiary)'
                                : 'var(--accent-cyan)',
                              border: '0.5px solid var(--border-default)',
                              cursor: realesrgan.installing ? 'wait' : 'pointer',
                            }}
                          >
                            {realesrgan.installing ? (
                              <>
                                <span className="animate-spin">↻</span> {realesrgan.progress.toFixed(0)}%
                              </>
                            ) : (
                              <>
                                <Download className="h-3 w-3" /> {tSetup('realesrganEnable')}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      {realesrgan.error && (
                        <p className="text-[11px]" style={{ color: 'var(--status-error)' }}>
                          {realesrgan.error}
                        </p>
                      )}
                      {!binaries?.realesrganInstalled && !realesrgan.installing && (
                        <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {tSetup('realesrganOptionalNote')}
                        </p>
                      )}

                      {/* 追加モデル（Real-ESRGAN 本体のインストール後に利用可能） */}
                      {binaries?.realesrganInstalled && (
                        <div className="space-y-2 pt-1">
                          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {tSetup('aiModelsTitle')}
                          </p>
                          {AI_UPSCALE_MODELS.filter((m) => m.extra).map((m) => (
                            <AiModelRow
                              key={m.id}
                              model={m}
                              installed={binaries.aiModels.includes(m.id)}
                              onInstalled={refreshBinaryStatus}
                            />
                          ))}
                          <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                            {tSetup('aiModelsLicenseNote')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {section === 'data' && (
                  <div className="space-y-4">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {t('dataDescription')}
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        className="flex items-center justify-between rounded-lg px-4 py-3 text-xs transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                          border: '0.5px solid var(--border-default)',
                        }}
                      >
                        <span>{t('export')}</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="flex items-center justify-between rounded-lg px-4 py-3 text-xs transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                          border: '0.5px solid var(--border-default)',
                        }}
                      >
                        <span>{t('import')}</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={handleReset}
                        className="flex items-center justify-between rounded-lg px-4 py-3 text-xs transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: 'rgba(239,71,111,0.08)',
                          color: 'var(--status-error)',
                          border: '0.5px solid rgba(239,71,111,0.3)',
                        }}
                      >
                        <span>{t('reset')}</span>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-2 px-5 py-3"
              style={{ borderTop: '0.5px solid var(--border-default)' }}
            >
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-1.5 text-xs transition-colors hover:opacity-80"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  border: '0.5px solid var(--border-default)',
                }}
              >
                {tCommon('close')}
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium transition-all"
                style={{
                  backgroundColor: saved
                    ? 'color-mix(in srgb, var(--status-success) 15%, transparent)'
                    : 'color-mix(in srgb, var(--accent-cyan) 15%, transparent)',
                  color: saved ? 'var(--status-success)' : 'var(--accent-cyan)',
                  border: saved
                    ? '0.5px solid var(--status-success)'
                    : '0.5px solid var(--accent-cyan)',
                }}
              >
                {saved ? <><Check className="h-3.5 w-3.5" /> {t('saved')}</> : t('save')}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
