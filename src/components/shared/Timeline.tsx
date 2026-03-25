'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

// ── ヘルパー ──────────────────────────────────────────────────────────────────

export function secondsToHMS(s: number): string {
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TimelineProps {
  duration: number;
  startTime: number;
  endTime: number;
  thumbnails?: string[];
  /** 波形データ (0–1 の正規化済みサンプル列) */
  waveform?: number[];
  onStartChange: (t: number) => void;
  onEndChange: (t: number) => void;
  /** タイムライン高さ (px, デフォルト 64) */
  height?: number;
  className?: string;
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export function Timeline({
  duration,
  startTime,
  endTime,
  thumbnails = [],
  waveform,
  onStartChange,
  onEndChange,
  height = 64,
  className = '',
}: TimelineProps) {
  const t = useTranslations('trim');
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging     = useRef<'start' | 'end' | null>(null);

  const timeFromX = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return 0;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current) return;
      const time = timeFromX(e.clientX);
      if (dragging.current === 'start') {
        onStartChange(Math.min(time, endTime - 0.5));
      } else {
        onEndChange(Math.max(time, startTime + 0.5));
      }
    },
    [timeFromX, startTime, endTime, onStartChange, onEndChange],
  );

  const onMouseUp = useCallback(() => {
    dragging.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  if (duration <= 0) return null;

  const startPct = (startTime / duration) * 100;
  const endPct   = (endTime   / duration) * 100;

  // 時間軸マーク
  const markCount = 8;
  const marks = Array.from({ length: markCount + 1 }, (_, i) => ({
    pct:  (i / markCount) * 100,
    time: (i / markCount) * duration,
  }));

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* 時間軸ルーラー */}
      <div className="relative h-4 px-0.5 select-none">
        {marks.map((mark) => (
          <span
            key={mark.pct}
            className="absolute top-0 -translate-x-1/2"
            style={{ left: `${mark.pct}%`, color: 'var(--text-tertiary)', fontSize: 10 }}
          >
            {secondsToHMS(mark.time).slice(0, 5)}
          </span>
        ))}
      </div>

      {/* トラック */}
      <div
        ref={containerRef}
        className="relative cursor-pointer select-none overflow-hidden rounded-lg"
        style={{
          height,
          backgroundColor: 'var(--bg-tertiary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        {/* サムネイル */}
        {thumbnails.length > 0 &&
          thumbnails.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt=""
              className="absolute top-0 h-full object-cover"
              style={{
                left:  `${(i / thumbnails.length) * 100}%`,
                width: `${100 / thumbnails.length}%`,
              }}
            />
          ))}

        {/* 波形オーバーレイ */}
        {waveform && waveform.length > 0 && (
          <svg
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            style={{ opacity: 0.4 }}
          >
            {waveform.map((amp, i) => {
              const x = (i / waveform.length) * 100;
              const barH = amp * 100;
              const y   = (100 - barH) / 2;
              return (
                <rect
                  key={i}
                  x={`${x}%`}
                  y={`${y}%`}
                  width={`${100 / waveform.length}%`}
                  height={`${barH}%`}
                  fill="var(--accent-cyan)"
                />
              );
            })}
          </svg>
        )}

        {/* 選択外のダーク overlay */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10"
          style={{ right: `${100 - startPct}%`, backgroundColor: 'rgba(0,0,0,0.55)' }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10"
          style={{ left: `${endPct}%`, backgroundColor: 'rgba(0,0,0,0.55)' }}
        />

        {/* 選択ハイライト */}
        <div
          className="pointer-events-none absolute inset-y-0 z-20"
          style={{
            left:  `${startPct}%`,
            right: `${100 - endPct}%`,
            backgroundColor: 'rgba(6,214,160,0.15)',
            border: '1px solid var(--accent-cyan)',
          }}
        />

        {/* 開始ハンドル */}
        <div
          className="absolute inset-y-0 z-30 flex cursor-ew-resize items-center justify-center"
          style={{ left: `calc(${startPct}% - 5px)`, width: 10 }}
          onMouseDown={(e) => {
            e.preventDefault();
            dragging.current = 'start';
          }}
        >
          <div
            className="h-full w-1.5 rounded-sm"
            style={{ backgroundColor: 'var(--accent-cyan)' }}
          />
        </div>

        {/* 終了ハンドル */}
        <div
          className="absolute inset-y-0 z-30 flex cursor-ew-resize items-center justify-center"
          style={{ left: `calc(${endPct}% - 5px)`, width: 10 }}
          onMouseDown={(e) => {
            e.preventDefault();
            dragging.current = 'end';
          }}
        >
          <div
            className="h-full w-1.5 rounded-sm"
            style={{ backgroundColor: 'var(--accent-cyan)' }}
          />
        </div>
      </div>

      {/* 選択範囲ラベル */}
      <div className="flex justify-center">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('duration')}: {secondsToHMS(endTime - startTime)}
        </span>
      </div>
    </div>
  );
}
