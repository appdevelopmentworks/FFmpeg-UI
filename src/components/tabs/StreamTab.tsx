'use client';

import { useTranslations } from 'next-intl';
import { Radio } from 'lucide-react';

export function StreamTab() {
  const t = useTranslations('stream');

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* URL Input */}
      <div
        className="flex items-center gap-3 rounded-xl p-4"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <Radio className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
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
          {t('connect')}
        </button>
      </div>

      {/* Preview area */}
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <Radio className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('preview')}
        </p>
      </div>

      {/* Recording controls */}
      <div
        className="flex items-center justify-between rounded-xl p-4"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--status-error)',
              color: '#fff',
            }}
          >
            ⏺ {t('startRecording')}
          </button>
          <button
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '0.5px solid var(--border-default)',
            }}
          >
            ⏹ {t('stopRecording')}
          </button>
        </div>
      </div>
    </div>
  );
}
