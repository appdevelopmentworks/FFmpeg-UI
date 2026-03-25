'use client';

import { useEffect, useRef, useCallback } from 'react';
import { checkBinaries, downloadBinary } from '@/lib/tauri/commands';
import {
  onSetupProgress,
  onSetupComplete,
  onSetupError,
  type SetupProgress,
  type SetupComplete,
} from '@/lib/tauri/events';
import { useUIStore } from '@/stores/uiStore';
import { useSetupStore } from '@/stores/setupStore';

export type SetupTool = 'ffmpeg' | 'ytdlp';

export function useSetup() {
  const setSetupDialogOpen = useUIStore((s) => s.setSetupDialogOpen);
  const {
    phase,
    ffmpegStatus,
    ytdlpStatus,
    setPhase,
    setToolStatus,
    setToolProgress,
    setToolError,
    setToolComplete,
    reset,
  } = useSetupStore();

  const unlistenRefs = useRef<Array<() => void>>([]);

  // イベントリスナーを登録・解除
  const attachListeners = useCallback(async () => {
    const unlistenProgress = await onSetupProgress((payload: SetupProgress) => {
      setToolProgress(payload.tool as SetupTool, {
        percent: payload.percent,
        downloaded: payload.downloaded,
        total: payload.total,
      });
    });

    const unlistenComplete = await onSetupComplete((payload: SetupComplete) => {
      setToolComplete(payload.tool as SetupTool, payload.version, payload.path);
    });

    const unlistenError = await onSetupError((payload) => {
      setToolError(payload.tool as SetupTool, payload.error);
    });

    unlistenRefs.current = [unlistenProgress, unlistenComplete, unlistenError];
  }, [setToolProgress, setToolComplete, setToolError]);

  const detachListeners = useCallback(() => {
    for (const unlisten of unlistenRefs.current) {
      unlisten();
    }
    unlistenRefs.current = [];
  }, []);

  // バイナリを確認し、足りなければダイアログを表示
  const checkAndSetup = useCallback(async () => {
    setPhase('checking');

    try {
      const status = await checkBinaries();

      const needsFfmpeg = !status.ffmpegInstalled;
      const needsYtdlp  = !status.ytdlpInstalled;

      if (!needsFfmpeg && !needsYtdlp) {
        // 両方インストール済み → セットアップ不要
        setToolComplete('ffmpeg', status.ffmpegVersion ?? '', status.ffmpegPath ?? '');
        setToolComplete('ytdlp',  status.ytdlpVersion  ?? '', status.ytdlpPath  ?? '');
        setPhase('ready');
        return;
      }

      // ダイアログを開いてダウンロードフロー開始
      setSetupDialogOpen(true);
      await attachListeners();
      setPhase('downloading');

      const downloads: Promise<void>[] = [];

      if (needsFfmpeg) {
        setToolStatus('ffmpeg', 'downloading');
        downloads.push(
          downloadBinary('ffmpeg')
            .then(() => { /* complete はイベントで受信 */ })
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              setToolError('ffmpeg', msg);
            }),
        );
      } else {
        setToolComplete('ffmpeg', status.ffmpegVersion ?? '', status.ffmpegPath ?? '');
      }

      if (needsYtdlp) {
        setToolStatus('ytdlp', 'downloading');
        downloads.push(
          downloadBinary('ytdlp')
            .then(() => { /* complete はイベントで受信 */ })
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              setToolError('ytdlp', msg);
            }),
        );
      } else {
        setToolComplete('ytdlp', status.ytdlpVersion ?? '', status.ytdlpPath ?? '');
      }

      await Promise.allSettled(downloads);
    } catch (err) {
      console.error('[useSetup] checkBinaries failed:', err);
      // Tauri 環境外 (Next.js dev) では無視する
      setPhase('ready');
    }
  }, [
    attachListeners,
    setPhase,
    setSetupDialogOpen,
    setToolComplete,
    setToolError,
    setToolStatus,
  ]);

  // ダイアログから呼ばれる再試行
  const retry = useCallback(
    async (tool: SetupTool) => {
      setToolStatus(tool, 'downloading');
      try {
        await downloadBinary(tool);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setToolError(tool, msg);
      }
    },
    [setToolError, setToolStatus],
  );

  // スキップ
  const skip = useCallback(() => {
    detachListeners();
    setSetupDialogOpen(false);
    setPhase('ready');
  }, [detachListeners, setPhase, setSetupDialogOpen]);

  // フェーズが 'ready' になったらダイアログを閉じる
  useEffect(() => {
    if (phase === 'ready') {
      // 両方完了のとき自動クローズ
      const ffOk = ffmpegStatus.phase === 'complete';
      const ytOk = ytdlpStatus.phase  === 'complete';
      if (ffOk && ytOk) {
        detachListeners();
        setTimeout(() => setSetupDialogOpen(false), 800);
      }
    }
  }, [
    phase,
    ffmpegStatus.phase,
    ytdlpStatus.phase,
    detachListeners,
    setSetupDialogOpen,
  ]);

  return { phase, ffmpegStatus, ytdlpStatus, checkAndSetup, retry, skip, reset };
}
