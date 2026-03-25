'use client';

import { useCallback } from 'react';
import {
  probeMedia,
  generateThumbnails,
  generateWaveform,
  trimMedia,
  extractStreams,
} from '@/lib/tauri/commands';
import type { MediaInfo, WaveformData } from '@/types/media';
import type { TrimParams, ExtractParams } from '@/types/ui';

/**
 * FFmpeg 操作のユーティリティフック。
 * 状態管理は行わない (useTrim / useExtract の下位レイヤー)。
 */
export function useFFmpeg() {
  const probe = useCallback(
    (path: string): Promise<MediaInfo> => probeMedia(path),
    [],
  );

  const thumbnails = useCallback(
    (path: string, count = 20): Promise<string[]> => generateThumbnails(path, count),
    [],
  );

  const waveform = useCallback(
    (path: string, samples = 1000): Promise<WaveformData> => generateWaveform(path, samples),
    [],
  );

  const trim = useCallback(
    (params: TrimParams): Promise<string> => trimMedia(params),
    [],
  );

  const extract = useCallback(
    (params: ExtractParams): Promise<string> => extractStreams(params),
    [],
  );

  return { probe, thumbnails, waveform, trim, extract };
}
