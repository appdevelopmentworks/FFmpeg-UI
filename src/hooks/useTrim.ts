'use client';

import { useCallback, useRef } from 'react';
import { probeMedia, generateThumbnails, trimMedia } from '@/lib/tauri/commands';
import { onJobProgress, onJobComplete, onJobError } from '@/lib/tauri/events';
import { useTrimStore } from '@/stores/trimStore';
import { useSettingsStore } from '@/stores/settingsStore';

export function useTrim() {
  const store = useTrimStore();
  const defaultOutputDir = useSettingsStore((s) => s.outputDir);
  const unlistenRefs = useRef<Array<() => void>>([]);

  const detachListeners = useCallback(() => {
    for (const fn of unlistenRefs.current) fn();
    unlistenRefs.current = [];
  }, []);

  const loadFile = useCallback(
    async (filePath: string) => {
      store.setFilePath(filePath);
      store.setProbeState('loading');
      store.resetJob();

      try {
        const info = await probeMedia(filePath);
        store.setMediaInfo(info);
        store.setProbeState('ready');

        // Auto-set output path next to input
        const ext = filePath.split('.').pop() ?? 'mp4';
        const base = filePath.replace(/\.[^.]+$/, '');
        store.setOutputPath(`${base}_trimmed.${ext}`);

        // Generate thumbnails in background (non-blocking)
        generateThumbnails(filePath, 20)
          .then((thumbs) => store.setThumbnails(thumbs))
          .catch(() => {});
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        store.setProbeError(msg);
        store.setProbeState('error');
      }
    },
    [store],
  );

  const executeTrim = useCallback(async () => {
    const { filePath, outputPath, startTime, endTime, accurate } = store;
    if (!filePath || !outputPath) return;

    detachListeners();
    store.resetJob();

    try {
      const jobId = await trimMedia({
        inputPath: filePath,
        outputPath,
        start: startTime,
        end: endTime,
        accurate,
      });

      store.startJob(jobId);

      const ulProgress = await onJobProgress(jobId, (p) => {
        store.updateJob(p.percent ?? 0, p.speed ?? '', p.eta ?? null);
      });
      const ulComplete = await onJobComplete(jobId, (r) => {
        store.completeJob(r.outputPath);
        detachListeners();
      });
      const ulError = await onJobError(jobId, (e) => {
        store.failJob(e.message);
        detachListeners();
      });

      unlistenRefs.current = [ulProgress, ulComplete, ulError];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      store.failJob(msg);
    }
  }, [store, detachListeners]);

  return {
    ...store,
    defaultOutputDir,
    loadFile,
    executeTrim,
  };
}
