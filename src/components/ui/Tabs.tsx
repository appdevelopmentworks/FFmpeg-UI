'use client';

import { motion } from 'framer-motion';
import { TRANSITIONS } from '@/lib/animations';

export interface TabItem<T extends string = string> {
  id:     T;
  label:  string;
  icon?:  React.ReactNode;
}

export interface TabsProps<T extends string = string> {
  tabs:       TabItem<T>[];
  active:     T;
  onChange:   (id: T) => void;
  layoutId?:  string;
  className?: string;
}

export function Tabs<T extends string = string>({
  tabs,
  active,
  onChange,
  layoutId = 'tab-indicator',
  className = '',
}: TabsProps<T>) {
  return (
    <div
      className={`flex items-end ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className="relative flex items-center gap-1.5 px-4 h-12 text-sm font-medium transition-colors"
            style={{
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-tertiary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }
            }}
          >
            {tab.icon && (
              <span className="shrink-0" style={{ opacity: isActive ? 1 : 0.6 }}>
                {tab.icon}
              </span>
            )}
            {tab.label}

            {/* Animated underline indicator */}
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute bottom-0 inset-x-0 h-0.5 rounded-full"
                style={{ backgroundColor: 'var(--accent-cyan)' }}
                transition={TRANSITIONS.tabSpring}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
