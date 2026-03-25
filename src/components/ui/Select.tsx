'use client';

import { forwardRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?:   string;
  error?:   string;
  hint?:    string;
  options:  SelectOption[];
  size?:    'sm' | 'md';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, size = 'md', className = '', style, ...rest }, ref) => {
    const [focused, setFocused] = useState(false);

    const borderColor = error
      ? 'var(--status-error)'
      : focused
        ? 'var(--accent-cyan)'
        : 'var(--border-default)';

    const height = size === 'sm' ? 'h-7' : 'h-8';

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

        <div className="relative">
          <select
            ref={ref}
            className={`w-full appearance-none rounded-md pl-2.5 pr-7 text-sm outline-none transition-colors ${height} ${className}`}
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: `0.5px solid ${borderColor}`,
              transition: 'border-color 0.15s ease',
              cursor: rest.disabled ? 'not-allowed' : 'pointer',
              ...style,
            }}
            onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
            onBlur={(e)  => { setFocused(false); rest.onBlur?.(e); }}
            {...rest}
          >
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              >
                {opt.label}
              </option>
            ))}
          </select>

          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
            size={13}
            style={{ color: 'var(--text-tertiary)' }}
          />
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

Select.displayName = 'Select';
