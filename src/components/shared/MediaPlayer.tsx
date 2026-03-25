'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function formatTime(s: number): string {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MediaPlayerProps {
  /** ファイルパスまたは URL */
  src: string;
  /** 映像ファイルかどうか (false の場合は音声プレーヤー表示) */
  isVideo?: boolean;
  className?: string;
}

// ── MediaPlayer ───────────────────────────────────────────────────────────────

export function MediaPlayer({ src, isVideo = true, className = '' }: MediaPlayerProps) {
  const mediaRef    = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const seekRef     = useRef<HTMLDivElement>(null);

  const [playing,  setPlaying]  = useState(false);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume,   setVolume]   = useState(1);
  const [muted,    setMuted]    = useState(false);
  const [seeking,  setSeeking]  = useState(false);

  // ── メディアイベント ─────────────────────────────────────────────────────

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;

    const onTimeUpdate  = () => setCurrent(el.currentTime);
    const onDuration    = () => setDuration(el.duration);
    const onPlay        = () => setPlaying(true);
    const onPause       = () => setPlaying(false);
    const onEnded       = () => setPlaying(false);

    el.addEventListener('timeupdate',  onTimeUpdate);
    el.addEventListener('loadedmetadata', onDuration);
    el.addEventListener('play',        onPlay);
    el.addEventListener('pause',       onPause);
    el.addEventListener('ended',       onEnded);

    return () => {
      el.removeEventListener('timeupdate',  onTimeUpdate);
      el.removeEventListener('loadedmetadata', onDuration);
      el.removeEventListener('play',        onPlay);
      el.removeEventListener('pause',       onPause);
      el.removeEventListener('ended',       onEnded);
    };
  }, [src]);

  // ── 操作 ─────────────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (playing) el.pause();
    else         el.play().catch(() => {});
  }, [playing]);

  const toggleMute = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    el.muted = !muted;
    setMuted(!muted);
  }, [muted]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (mediaRef.current) {
      mediaRef.current.volume = v;
      if (v === 0) setMuted(true);
      else if (muted) {
        mediaRef.current.muted = false;
        setMuted(false);
      }
    }
  }, [muted]);

  // シークバークリック / ドラッグ
  const seekFromX = useCallback((clientX: number) => {
    const rect = seekRef.current?.getBoundingClientRect();
    if (!rect || duration <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time  = ratio * duration;
    setCurrent(time);
    if (mediaRef.current) mediaRef.current.currentTime = time;
  }, [duration]);

  const handleSeekMouseDown = useCallback((e: React.MouseEvent) => {
    setSeeking(true);
    seekFromX(e.clientX);
  }, [seekFromX]);

  useEffect(() => {
    if (!seeking) return;
    const onMove = (e: MouseEvent) => seekFromX(e.clientX);
    const onUp   = ()              => setSeeking(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [seeking, seekFromX]);

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  // ── レンダー ─────────────────────────────────────────────────────────────

  return (
    <div
      className={`flex flex-col gap-2 overflow-hidden rounded-xl ${className}`}
      style={{ backgroundColor: 'var(--bg-secondary)', border: '0.5px solid var(--border-default)' }}
    >
      {/* 映像エリア */}
      {isVideo ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={src}
          className="w-full"
          style={{ maxHeight: 200, objectFit: 'contain', backgroundColor: '#000' }}
          onClick={togglePlay}
        />
      ) : (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={src}
          className="hidden"
        />
      )}

      {/* コントロール */}
      <div className="flex flex-col gap-2 px-3 pb-3">
        {/* シークバー */}
        <div
          ref={seekRef}
          className="relative h-2 cursor-pointer rounded-full"
          style={{ backgroundColor: 'var(--bg-tertiary)' }}
          onMouseDown={handleSeekMouseDown}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: 'var(--accent-cyan)', width: `${progress}%` }}
          />
          {/* シークサム */}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full"
            style={{ left: `${progress}%`, backgroundColor: 'var(--accent-cyan)' }}
          />
        </div>

        {/* ボタン行 */}
        <div className="flex items-center gap-3">
          {/* 再生/停止 */}
          <button
            onClick={togglePlay}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{ backgroundColor: 'var(--accent-cyan)' }}
          >
            {playing
              ? <Pause  className="h-3.5 w-3.5" style={{ color: '#000' }} />
              : <Play   className="h-3.5 w-3.5" style={{ color: '#000', marginLeft: 1 }} />}
          </button>

          {/* 時間 */}
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            {formatTime(current)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* ミュート */}
          <button
            onClick={toggleMute}
            className="flex h-6 w-6 items-center justify-center rounded transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {muted || volume === 0
              ? <VolumeX className="h-3.5 w-3.5" />
              : <Volume2 className="h-3.5 w-3.5" />}
          </button>

          {/* 音量スライダー */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={muted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 cursor-pointer"
            style={{ accentColor: 'var(--accent-cyan)' }}
          />
        </div>
      </div>
    </div>
  );
}
