'use client';

import { useTranslations } from 'next-intl';
import { Youtube } from 'lucide-react';

export function YouTubeTab() {
  const t = useTranslations('youtube');

  return (
    <div className="flex h-full flex-col p-6">
      {/* URL Input */}
      <div
        className="flex items-center gap-3 rounded-xl p-4"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <Youtube className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
        <input
          type="text"
          placeholder={t('urlPlaceholder')}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
        <button
          className="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--accent-cyan-dim)',
            color: 'var(--accent-cyan)',
          }}
        >
          {t('fetch')}
        </button>
      </div>

      {/* Placeholder content */}
      <div
        className="mt-6 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <Youtube className="h-12 w-12" style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('urlPlaceholder')}
        </p>
      </div>
    </div>
  );
}
