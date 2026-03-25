'use client';

import { motion } from 'framer-motion';

export type ProgressVariant = 'default' | 'success' | 'warning' | 'error';

export interface ProgressBarProps {
  value:       number;          // 0–100
  variant?:    ProgressVariant;
  label?:      string;
  showValue?:  boolean;
  animated?:   boolean;        // pulse animation when running
  height?:     number;
  className?:  string;
}

const COLORS: Record<ProgressVariant, string> = {
  default: 'var(--accent-cyan)',
  success: 'var(--status-success)',
  warning: 'var(--status-warning)',
  error:   'var(--status-error)',
};

function autoVariant(value: number): ProgressVariant {
  if (value >= 100) return 'success';
  return 'default';
}

export function ProgressBar({
  value,
  variant,
  label,
  showValue = true,
  animated = false,
  height = 4,
  className = '',
}: ProgressBarProps) {
  const pct    = Math.max(0, Math.min(100, value));
  const v      = variant ?? autoVariant(pct);
  const color  = COLORS[v];

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {label}
            </span>
          )}
          {showValue && (
            <span
              className="text-xs tabular-nums font-mono"
              style={{ color }}
            >
              {pct.toFixed(0)}%
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        className="relative w-full overflow-hidden rounded-full"
        style={{
          height,
          backgroundColor: 'var(--bg-tertiary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        {/* Fill */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        />

        {/* Animated shimmer overlay */}
        {animated && pct > 0 && pct < 100 && (
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)`,
              backgroundSize: '200% 100%',
            }}
            animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>
    </div>
  );
}
