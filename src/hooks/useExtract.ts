'use client';

import { useCallback, useRef } from 'react';
import { probeMedia, extractStreams } from '@/lib/tauri/commands';
import { onJobProgress, onJobComplete, onJobError } from '@/lib/tauri/events';
import { useExtractStore } from '@/stores/extractStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { StreamExtraction } from '@/types/ui';

export function useExtract() {
  const store = useExtractStore();
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

        if (!store.outputDir) {
          const dir = filePath.replace(/[/\\][^/\\]+$/, '');
          store.setOutputDir(dir || defaultOutputDir);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        store.setProbeError(msg);
        store.setProbeState('error');
      }
    },
    [store, defaultOutputDir],
  );

  const executeExtract = useCallback(async () => {
    const { filePath, outputDir, selections } = store;
    const active = selections.filter((s) => s.selected);
    if (!filePath || active.length === 0) return;

    detachListeners();
    store.resetJob();

    const extractions: StreamExtraction[] = active.map((s) => ({
      streamIndex: s.streamIndex,
      outputFormat: s.outputFormat,
      options: s.options,
    }));

    try {
      const jobId = await extractStreams({ inputPath: filePath, extractions, outputDir });
      store.startJob(jobId);

      const ulProgress = await onJobProgress(jobId, (p) => {
        store.updateJob(p.percent ?? 0, p.speed ?? '');
      });
      const ulComplete = await onJobComplete(jobId, (r) => {
        store.completeJob(r.outputPath ?? outputDir);
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
    executeExtract,
  };
}
