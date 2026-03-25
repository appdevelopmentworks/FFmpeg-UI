'use client';

import { forwardRef } from 'react';

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?:       string;
  hint?:        string;
  showValue?:   boolean;
  valueLabel?:  string;
  min?:         number;
  max?:         number;
  step?:        number;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      label,
      hint,
      showValue = true,
      valueLabel,
      value,
      min = 0,
      max = 100,
      step = 1,
      className = '',
      style,
      ...rest
    },
    ref,
  ) => {
    const numValue = Number(value ?? min);
    const pct      = ((numValue - min) / (max - min)) * 100;
    const displayVal = valueLabel ?? numValue;

    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {(label || showValue) && (
          <div className="flex items-center justify-between">
            {label && (
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {label}
              </span>
            )}
            {showValue && (
              <span
                className="text-xs tabular-nums font-mono"
                style={{ color: 'var(--accent-cyan)' }}
              >
                {displayVal}
              </span>
            )}
          </div>
        )}

        <div className="relative flex items-center h-5">
          {/* Track background */}
          <div
            className="absolute inset-x-0 h-1 rounded-full"
            style={{ backgroundColor: 'var(--bg-tertiary)', border: '0.5px solid var(--border-default)' }}
          />
          {/* Track fill */}
          <div
            className="absolute left-0 h-1 rounded-full transition-all duration-75"
            style={{
              width: `${pct}%`,
              backgroundColor: 'var(--accent-cyan)',
            }}
          />
          {/* Native input (transparent, on top) */}
          <input
            ref={ref}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            style={{ height: '100%', ...style }}
            {...rest}
          />
          {/* Thumb visual */}
          <div
            className="absolute w-3.5 h-3.5 rounded-full border-2 pointer-events-none transition-all duration-75"
            style={{
              left: `calc(${pct}% - 7px)`,
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--accent-cyan)',
              boxShadow: '0 0 0 3px var(--accent-cyan-dim)',
            }}
          />
        </div>

        {hint && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Slider.displayName = 'Slider';
