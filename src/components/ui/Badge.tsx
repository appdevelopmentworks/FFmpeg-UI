'use client';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'cyan';

export interface BadgeProps {
  children:   React.ReactNode;
  variant?:   BadgeVariant;
  size?:      'sm' | 'md';
  dot?:       boolean;
  className?: string;
}

const STYLES: Record<BadgeVariant, { color: string; bg: string; dot: string }> = {
  default: { color: 'var(--text-secondary)', bg: 'var(--bg-tertiary)',     dot: 'var(--text-tertiary)' },
  success: { color: 'var(--status-success)', bg: 'rgba(6,214,160,0.12)',   dot: 'var(--status-success)' },
  warning: { color: 'var(--status-warning)', bg: 'rgba(255,209,102,0.12)', dot: 'var(--status-warning)' },
  error:   { color: 'var(--status-error)',   bg: 'rgba(239,71,111,0.12)',   dot: 'var(--status-error)' },
  info:    { color: 'var(--status-info)',    bg: 'rgba(72,149,239,0.12)',   dot: 'var(--status-info)' },
  cyan:    { color: 'var(--accent-cyan)',    bg: 'var(--accent-cyan-dim)',  dot: 'var(--accent-cyan)' },
};

export function Badge({ children, variant = 'default', size = 'sm', dot = false, className = '' }: BadgeProps) {
  const s     = STYLES[variant];
  const isSm  = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium ${isSm ? 'h-5 px-1.5 text-xs' : 'h-6 px-2 text-xs'} ${className}`}
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: s.dot }}
        />
      )}
      {children}
    </span>
  );
}
