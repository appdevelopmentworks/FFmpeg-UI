'use client';

import { useCallback, useRef } from 'react';
import { fetchVideoInfo, startDownload, cancelDownload } from '@/lib/tauri/commands';
import { onDownloadProgress, onDownloadComplete, onDownloadError } from '@/lib/tauri/events';
import { useYtDlpStore } from '@/stores/ytdlpStore';
import type { DownloadParams } from '@/types/ytdlp';

export function useYtDlp() {
  const store = useYtDlpStore();
  const unlistenRefs = useRef<Array<() => void>>([]);

  const detachListeners = useCallback(() => {
    for (const unlisten of unlistenRefs.current) {
      unlisten();
    }
    unlistenRefs.current = [];
  }, []);

  const fetchInfo = useCallback(
    async (url: string) => {
      console.warn('[useYtDlp] fetchInfo called with:', url);
      store.startFetch(url);

      try {
        const info = await fetchVideoInfo(url);
        console.warn('[useYtDlp] fetchVideoInfo success:', info.title);
        store.setVideoInfo(info);

        // Auto-select best combined format
        const best = info.formats
          .filter((f) => f.hasVideo && f.hasAudio)
          .sort((a, b) => (b.filesize ?? b.filesizeApprox ?? 0) - (a.filesize ?? a.filesizeApprox ?? 0))[0];
        if (best) store.setSelectedFormatId(best.formatId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[useYtDlp] fetchVideoInfo error:', msg);
        store.setFetchError(msg);
      }
    },
    [store],
  );

  const download = useCallback(
    async (params: DownloadParams) => {
      detachListeners();
      store.resetDownload();

      try {
        const jobId = await startDownload(params);
        store.startDownloadJob(jobId);

        const unlistenProgress = await onDownloadProgress(jobId, (progress) => {
          store.updateDownloadProgress(progress);
        });

        const unlistenComplete = await onDownloadComplete(jobId, ({ outputPath }) => {
          store.setDownloadComplete(outputPath);
          detachListeners();
        });

        const unlistenError = await onDownloadError(jobId, ({ message }) => {
          store.setDownloadError(message);
          detachListeners();
        });

        unlistenRefs.current = [unlistenProgress, unlistenComplete, unlistenError];
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        store.setDownloadError(msg);
      }
    },
    [store, detachListeners],
  );

  const cancel = useCallback(async () => {
    const { jobId } = store.download;
    if (!jobId) return;
    detachListeners();
    try {
      await cancelDownload(jobId);
    } catch (err) {
      console.error('[useYtDlp] cancel failed:', err);
    }
    store.resetDownload();
  }, [store, detachListeners]);

  return {
    url: store.url,
    fetchState: store.fetchState,
    videoInfo: store.videoInfo,
    fetchError: store.fetchError,
    selectedFormatId: store.selectedFormatId,
    outputDir: store.outputDir,
    download: store.download,
    setSelectedFormatId: store.setSelectedFormatId,
    setOutputDir: store.setOutputDir,
    fetchInfo,
    startDownload: download,
    cancelDownload: cancel,
  };
}
