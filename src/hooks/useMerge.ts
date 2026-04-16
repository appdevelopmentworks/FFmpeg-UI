'use client';

import { useCallback, useRef } from 'react';
import { probeMedia, mergeMedia } from '@/lib/tauri/commands';
import { onJobProgress, onJobComplete, onJobError } from '@/lib/tauri/events';
import { useMergeStore } from '@/stores/mergeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { MergeFile } from '@/stores/mergeStore';

export function useMerge() {
  const store = useMergeStore();
  const defaultOutputDir = useSettingsStore((s) => s.outputDir);
  const unlistenRefs = useRef<Array<() => void>>([]);

  const detachListeners = useCallback(() => {
    for (const fn of unlistenRefs.current) fn();
    unlistenRefs.current = [];
  }, []);

  const addFiles = useCallback(
    async (paths: string[]) => {
      store.setProbeState('loading');

      try {
        const probed: MergeFile[] = [];
        for (const path of paths) {
          const info = await probeMedia(path);
          probed.push({
            path: info.path,
            name: info.filename,
            duration: info.duration,
            size: info.size,
          });
        }
        store.addFiles(probed);
        store.setProbeState('ready');

        // Auto-set output path from first file if not set
        const currentFiles = useMergeStore.getState().files;
        if (currentFiles.length > 0 && !useMergeStore.getState().outputPath) {
          const first = currentFiles[0].path;
          const ext = first.split('.').pop() ?? 'mp4';
          const base = first.replace(/\.[^.]+$/, '');
          store.setOutputPath(`${base}_merged.${ext}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        store.failJob(msg);
        store.setProbeState('error');
      }
    },
    [store],
  );

  const executeMerge = useCallback(async () => {
    const { files, outputPath } = useMergeStore.getState();
    if (files.length < 2 || !outputPath) return;

    detachListeners();
    store.resetJob();

    try {
      const inputPaths = files.map((f) => f.path);
      const jobId = await mergeMedia({ inputPaths, outputPath });

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
    addFiles,
    executeMerge,
  };
}
