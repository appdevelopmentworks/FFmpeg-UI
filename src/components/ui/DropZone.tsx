'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FolderOpen } from 'lucide-react';

export interface DropZoneProps {
  onDrop:      (files: File[]) => void;
  accept?:     string[];           // e.g. ['.mp4', '.mkv']
  multiple?:   boolean;
  label?:      string;
  sublabel?:   string;
  icon?:       React.ReactNode;
  className?:  string;
  disabled?:   boolean;
}

export function DropZone({
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

    const items = Array.from(e.dataTransfer.files);
    const filtered = accept
      ? items.filter((f) => accept.some((ext) => f.name.toLowerCase().endsWith(ext)))
      : items;
    if (filtered.length) onDrop(filtered);
  }, [onDrop, accept, disabled]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const items = Array.from(e.target.files ?? []);
    if (items.length) onDrop(items);
    e.target.value = '';
  }, [onDrop]);

  return (
    <motion.label
      className={`relative flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer select-none overflow-hidden ${className}`}
      style={{
        minHeight: 120,
        backgroundColor: dragging ? 'var(--accent-cyan-dim)' : 'var(--bg-secondary)',
        border: `1.5px dashed ${dragging ? 'var(--accent-cyan)' : 'var(--border-hover)'}`,
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      animate={{ scale: dragging ? 1.01 : 1 }}
      transition={{ duration: 0.15 }}
    >
      <input
        type="file"
        className="sr-only"
        multiple={multiple}
        accept={accept?.join(',')}
        disabled={disabled}
        onChange={handleChange}
      />

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
    </motion.label>
  );
}
