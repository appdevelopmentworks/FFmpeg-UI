'use client';

import { motion } from 'framer-motion';
import { TRANSITIONS } from '@/lib/animations';

export interface SegmentOption<T extends string = string> {
  value:    T;
  label:    string;
  icon?:    React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options:   SegmentOption<T>[];
  value:     T;
  onChange:  (value: T) => void;
  size?:     'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: SegmentedControlProps<T>) {
  const isSm      = size === 'sm';
  const height    = isSm ? 'h-7' : 'h-8';
  const textSize  = isSm ? 'text-xs' : 'text-sm';

  return (
    <div
      className={`relative inline-flex rounded-lg p-0.5 gap-0.5 ${height} ${className}`}
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        border: '0.5px solid var(--border-default)',
      }}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onChange(opt.value)}
            className={`relative flex items-center gap-1.5 px-3 rounded-md font-medium transition-colors ${textSize}`}
            style={{
              color: isActive
                ? 'var(--text-primary)'
                : 'var(--text-secondary)',
              cursor: opt.disabled ? 'not-allowed' : 'pointer',
              opacity: opt.disabled ? 0.4 : 1,
              zIndex: 1,
            }}
          >
            {/* Animated active bg */}
            {isActive && (
              <motion.span
                layoutId="seg-indicator"
                className="absolute inset-0 rounded-md"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  boxShadow: 'var(--shadow-sm)',
                }}
                transition={TRANSITIONS.spring}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {opt.icon && <span className="shrink-0">{opt.icon}</span>}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
