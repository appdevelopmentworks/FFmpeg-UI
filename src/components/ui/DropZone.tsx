'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FolderOpen } from 'lucide-react';

export interface DropZoneProps {
  /** Tauri用: フルパス文字列の配列を受け取るコールバック（推奨） */
  onFileDrop?:  (paths: string[]) => void;
  /** HTML5フォールバック: File オブジェクトの配列を受け取るコールバック */
  onDrop?:      (files: File[]) => void;
  accept?:     string[];           // e.g. ['.mp4', '.mkv']
  multiple?:   boolean;
  label?:      string;
  sublabel?:   string;
  icon?:       React.ReactNode;
  className?:  string;
  disabled?:   boolean;
}

/** ファイル拡張子でフィルタする */
function filterByExtension(paths: string[], accept?: string[]): string[] {
  if (!accept || accept.length === 0) return paths;
  return paths.filter((p) => accept.some((ext) => p.toLowerCase().endsWith(ext)));
}

/** accept配列を拡張子リスト文字列に変換 (e.g. ['.mp4', '.mkv'] → ['mp4', 'mkv']) */
function acceptToExtensions(accept?: string[]): string[] {
  if (!accept) return [];
  return accept.map((ext) => ext.replace(/^\./, ''));
}

export function DropZone({
  onFileDrop,
  onDrop,
  accept,
  multiple = true,
  label,
  sublabel,
  icon,
  className = '',
  disabled = false,
}: DropZoneProps) {
  const tc = useTranslations('common');
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  // ── Tauri ファイルドロップイベント ─────────────────────────────────────────
  useEffect(() => {
    if (disabled || !onFileDrop) return;
    if (!isTauri) return;

    let unlisten: (() => void) | null = null;

    (async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const webview = getCurrentWebview();
        unlisten = await webview.onDragDropEvent((event) => {
          if (event.payload.type === 'enter') {
            setDragging(true);
          } else if (event.payload.type === 'leave') {
            setDragging(false);
          } else if (event.payload.type === 'drop') {
            setDragging(false);
            const paths = event.payload.paths;
            const filtered = filterByExtension(paths, accept);
            const result = multiple ? filtered : filtered.slice(0, 1);
            if (result.length > 0) {
              onFileDrop(result);
            }
          }
        });
      } catch (err) {
        console.warn('[DropZone] Tauri drag-drop not available:', err);
      }
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }, [disabled, onFileDrop, accept, multiple, isTauri]);

  // ── クリック時のファイル選択 ─────────────────────────────────────────────
  const handleClick = useCallback(async (e: React.MouseEvent) => {
    if (disabled) return;

    // Tauri環境 + onFileDrop の場合はTauriのファイルダイアログを使う
    if (isTauri && onFileDrop) {
      e.preventDefault();
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const extensions = acceptToExtensions(accept);
        const result = await open({
          multiple,
          filters: extensions.length > 0
            ? [{ name: 'Media', extensions }]
            : undefined,
        });
        if (result) {
          const paths = Array.isArray(result) ? result : [result];
          if (paths.length > 0) onFileDrop(paths);
        }
      } catch (err) {
        console.warn('[DropZone] Tauri dialog error:', err);
      }
      return;
    }
    // ブラウザ環境: input[type=file] のデフォルト動作に任せる（labelのクリック）
  }, [disabled, isTauri, onFileDrop, accept, multiple]);

  // ── HTML5 フォールバック（ブラウザ用） ────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;

    // Tauri環境ではonDragDropEventで処理するのでスキップ
    if (isTauri && onFileDrop) return;

    if (onDrop) {
      const items = Array.from(e.dataTransfer.files);
      const filtered = accept
        ? items.filter((f) => accept.some((ext) => f.name.toLowerCase().endsWith(ext)))
        : items;
      if (filtered.length) onDrop(filtered);
    }
  }, [onDrop, onFileDrop, accept, disabled, isTauri]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const items = Array.from(e.target.files ?? []);
    if (items.length) {
      if (onDrop) onDrop(items);
    }
    e.target.value = '';
  }, [onDrop]);

  return (
    <motion.div
      ref={containerRef}
      className={`relative flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer select-none overflow-hidden ${className}`}
      style={{
        minHeight: 120,
        backgroundColor: dragging ? 'var(--accent-cyan-dim)' : 'var(--bg-secondary)',
        border: `1.5px dashed ${dragging ? 'var(--accent-cyan)' : 'var(--border-hover)'}`,
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      animate={{ scale: dragging ? 1.01 : 1 }}
      transition={{ duration: 0.15 }}
    >
      {/* ブラウザ環境用の隠しinput（Tauri環境ではダイアログを使うので不要） */}
      {!isTauri && (
        <label className="absolute inset-0 cursor-pointer">
          <input
            type="file"
            className="sr-only"
            multiple={multiple}
            accept={accept?.join(',')}
            disabled={disabled}
            onChange={handleChange}
          />
        </label>
      )}

      <AnimatePresence mode="wait">
        {dragging ? (
          <motion.div
            key="dragging"
            className="flex flex-col items-center gap-2"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1,    opacity: 1 }}
            exit={{    scale: 0.85, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <FolderOpen size={28} style={{ color: 'var(--accent-cyan)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--accent-cyan)' }}>
              {tc('dropHere')}
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            className="flex flex-col items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              {icon ?? <Upload size={20} style={{ color: 'var(--text-secondary)' }} />}
            </div>
            <div className="flex flex-col items-center gap-0.5 text-center px-4">
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {label ?? tc('dragOrClick')}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {sublabel ?? (accept ? accept.join(', ') : tc('dragOrClick'))}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
