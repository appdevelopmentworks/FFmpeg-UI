'use client';

import { forwardRef } from 'react';
import { motion } from 'framer-motion';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?:    ButtonSize;
  loading?: boolean;
  icon?:    React.ReactNode;
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-7  px-2.5 text-xs  gap-1.5 rounded-md',
  md: 'h-8  px-3   text-sm  gap-2   rounded-md',
  lg: 'h-9  px-4   text-sm  gap-2   rounded-lg',
};

const VAR_STYLE: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--accent-cyan)',
    color: '#0a0a0f',
    fontWeight: 500,
  },
  secondary: {
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '0.5px solid var(--border-default)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
  },
  danger: {
    backgroundColor: 'var(--status-error)',
    color: '#ffffff',
    fontWeight: 500,
  },
};

// Typed as plain object so Framer Motion accepts it for whileHover
const HOVER_STYLE: Record<ButtonVariant, Record<string, string | number>> = {
  primary:   { filter: 'brightness(1.1)' },
  secondary: { borderColor: 'var(--border-hover)', backgroundColor: 'var(--bg-tertiary)' },
  ghost:     { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' },
  danger:    { filter: 'brightness(1.08)' },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size    = 'md',
      loading = false,
      icon,
      children,
      disabled,
      className = '',
      style,
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        className={`inline-flex items-center justify-center font-medium transition-colors select-none ${SIZE[size]} ${className}`}
        style={{
          ...VAR_STYLE[variant],
          opacity: isDisabled ? 0.45 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          ...style,
        }}
        whileHover={isDisabled ? undefined : { ...HOVER_STYLE[variant] }}
        whileTap={isDisabled ? undefined : { scale: 0.96 }}
        transition={{ duration: 0.15 }}
        disabled={isDisabled}
        {...(rest as React.ComponentProps<typeof motion.button>)}
      >
        {loading ? (
          <svg
            className="animate-spin"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </motion.button>
    );
  },
);

Button.displayName = 'Button';
