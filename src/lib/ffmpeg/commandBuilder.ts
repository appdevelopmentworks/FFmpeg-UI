import type { FFmpegCommand } from '@/types/ffmpeg';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

/**
 * FFmpegCommandからコマンド引数配列を生成する（フロントエンド側プレビュー用）
 * Rustのbuild_commandと同じロジック
 */
export function buildArgs(cmd: FFmpegCommand): string[] {
  const args: string[] = ['-y'];

  // Fast-seek trim (before input)
  if (cmd.trim && !cmd.trim.accurate) {
    args.push('-ss', formatTime(cmd.trim.start));
  }

  // Input
  args.push('-i', cmd.inputPath);

  // Accurate trim (after input)
  if (cmd.trim && cmd.trim.accurate) {
    args.push('-ss', formatTime(cmd.trim.start));
    const dur = Math.max(cmd.trim.end - cmd.trim.start, 0.001);
    args.push('-t', formatTime(dur));
  }

  // ── Video ──────────────────────────────────────────────────────────────
  if (cmd.noVideo) {
    args.push('-vn');
  } else if (cmd.copyVideo) {
    args.push('-c:v', 'copy');
  } else if (cmd.videoCodec) {
    args.push('-c:v', cmd.videoCodec);

    if (cmd.crf !== undefined) {
      args.push('-crf', String(cmd.crf));
    }
    if (cmd.videoBitrate) {
      args.push('-b:v', cmd.videoBitrate);
    }
    if (cmd.preset) {
      args.push('-preset', cmd.preset);
    }
  }

  // Video filters
  const vfParts: string[] = [];
  if (cmd.resolution) {
    vfParts.push(`scale=${cmd.resolution.width}:${cmd.resolution.height}`);
  }
  for (const f of cmd.filters.filter((f) => f.enabled && f.category === 'video')) {
    const params = Object.entries(f.params)
      .map(([k, v]) => `${k}=${v}`)
      .join(':');
    vfParts.push(params ? `${f.name}=${params}` : f.name);
  }
  if (vfParts.length > 0) {
    args.push('-vf', vfParts.join(','));
  }

  // FPS
  if (cmd.fps !== undefined) {
    args.push('-r', String(cmd.fps));
  }

  // ── Audio ──────────────────────────────────────────────────────────────
  if (cmd.noAudio) {
    args.push('-an');
  } else if (cmd.copyAudio) {
    args.push('-c:a', 'copy');
  } else if (cmd.audioCodec) {
    args.push('-c:a', cmd.audioCodec);
    if (cmd.audioBitrate) {
      args.push('-b:a', cmd.audioBitrate);
    }
  }

  // Audio filters
  const afParts = cmd.filters
    .filter((f) => f.enabled && f.category === 'audio')
    .map((f) => {
      const params = Object.entries(f.params)
        .map(([k, v]) => `${k}=${v}`)
        .join(':');
      return params ? `${f.name}=${params}` : f.name;
    });
  if (afParts.length > 0) {
    args.push('-af', afParts.join(','));
  }

  // Extra args
  args.push(...cmd.extraArgs);

  // Output
  args.push(cmd.outputPath);

  return args;
}

/**
 * FFmpegCommandからプレビュー文字列を生成する
 */
export function buildCommandString(cmd: FFmpegCommand): string {
  const args = buildArgs(cmd);
  const parts = ['ffmpeg', ...args].map((a) =>
    a.includes(' ') ? `"${a}"` : a,
  );
  return parts.join(' ');
}

/**
 * 出力ファイルサイズを推定する（バイト）
 */
export function estimateSize(
  duration: number,
  videoBitrate?: number, // bps
  audioBitrate?: number, // bps
  crf?: number,
  codec?: string,
): number {
  let effectiveVideoBps = videoBitrate ?? 0;

  if (!effectiveVideoBps && crf !== undefined) {
    const base =
      codec?.includes('265') || codec?.includes('hevc')
        ? 1_000_000
        : codec?.includes('vp9') || codec?.includes('vpx')
          ? 900_000
          : codec?.includes('av1') || codec?.includes('aom')
            ? 600_000
            : 2_000_000; // H.264 default ~2Mbps at CRF23

    const multiplier = Math.pow(2, (23 - crf) / 6);
    effectiveVideoBps = Math.round(base * multiplier);
  }

  const effectiveAudioBps = audioBitrate ?? 192_000;
  const totalBps = effectiveVideoBps + effectiveAudioBps;

  if (totalBps === 0 || duration <= 0) return 0;

  return Math.round((totalBps * duration) / 8);
}

/** バイト数を人間が読みやすい形式に変換 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
