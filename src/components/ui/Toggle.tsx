'use client';

import { motion } from 'framer-motion';
import { TRANSITIONS } from '@/lib/animations';

export interface ToggleProps {
  checked:   boolean;
  onChange:  (checked: boolean) => void;
  label?:    string;
  hint?:     string;
  disabled?: boolean;
  size?:     'sm' | 'md';
}

export function Toggle({ checked, onChange, label, hint, disabled = false, size = 'md' }: ToggleProps) {
  const isSm = size === 'sm';
  const trackW = isSm ? 28 : 36;
  const trackH = isSm ? 16 : 20;
  const thumbS = isSm ? 12 : 16;
  const thumbOff = isSm ? 2 : 2;
  const thumbOn  = trackW - thumbS - thumbOff;

  return (
    <label
      className="flex items-center gap-2.5 select-none"
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1 }}
    >
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative shrink-0 rounded-full outline-none transition-colors"
        style={{
          width:  trackW,
          height: trackH,
          backgroundColor: checked ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
          border: `0.5px solid ${checked ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }}
      >
        <motion.span
          className="absolute top-0 rounded-full"
          style={{
            width:  thumbS,
            height: thumbS,
            top:    thumbOff,
            backgroundColor: checked ? '#0a0a0f' : 'var(--text-tertiary)',
          }}
          animate={{ x: checked ? thumbOn : thumbOff }}
          transition={TRANSITIONS.spring}
        />
      </button>

      {(label || hint) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {label}
            </span>
          )}
          {hint && (
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {hint}
            </span>
          )}
        </div>
      )}
    </label>
  );
}
