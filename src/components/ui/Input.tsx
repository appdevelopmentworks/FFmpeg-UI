'use client';

import { forwardRef, useState } from 'react';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?:     string;
  error?:     string;
  hint?:      string;
  prefix?:    React.ReactNode;
  suffix?:    React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, prefix, suffix, className = '', style, ...rest }, ref) => {
    const [focused, setFocused] = useState(false);

    const borderColor = error
      ? 'var(--status-error)'
      : focused
        ? 'var(--accent-cyan)'
        : 'var(--border-default)';

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            className="text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {label}
          </label>
        )}

        <div
          className="flex items-center h-8 rounded-md overflow-hidden transition-colors"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: `0.5px solid ${borderColor}`,
            transition: 'border-color 0.15s ease',
          }}
        >
          {prefix && (
            <span
              className="flex items-center pl-2.5 shrink-0"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {prefix}
            </span>
          )}

          <input
            ref={ref}
            className={`flex-1 bg-transparent px-2.5 text-sm outline-none min-w-0 ${className}`}
            style={{
              color: 'var(--text-primary)',
              caretColor: 'var(--accent-cyan)',
              ...style,
            }}
            onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
            onBlur={(e)  => { setFocused(false); rest.onBlur?.(e); }}
            {...rest}
          />

          {suffix && (
            <span
              className="flex items-center pr-2.5 shrink-0"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {suffix}
            </span>
          )}
        </div>

        {(error || hint) && (
          <p
            className="text-xs"
            style={{ color: error ? 'var(--status-error)' : 'var(--text-tertiary)' }}
          >
            {error ?? hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
