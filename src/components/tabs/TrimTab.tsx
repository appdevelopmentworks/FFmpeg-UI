'use client';

import { useTranslations } from 'next-intl';
import { Scissors, Upload } from 'lucide-react';

export function TrimTab() {
  const t = useTranslations('trim');

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Drop Zone */}
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-xl py-10 transition-colors"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px dashed var(--border-hover)',
        }}
      >
        <Upload className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          ファイルをドラッグ&ドロップ または クリックして選択
        </p>
      </div>

      {/* Timeline placeholder */}
      <div
        className="h-20 rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      />

      {/* Time inputs */}
      <div className="flex items-center gap-4">
        <div
          className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '0.5px solid var(--border-default)',
          }}
        >
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('start')}
          </span>
          <input
            type="text"
            placeholder="00:00:00.000"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}
          />
        </div>
        <span style={{ color: 'var(--text-tertiary)' }}>→</span>
        <div
          className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '0.5px solid var(--border-default)',
          }}
        >
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('end')}
          </span>
          <input
            type="text"
            placeholder="00:00:00.000"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}
          />
        </div>
      </div>

      {/* Execute button placeholder */}
      <div className="flex items-center justify-center">
        <button
          className="flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--accent-cyan-dim)',
            color: 'var(--accent-cyan)',
            border: '0.5px solid var(--accent-cyan)',
          }}
        >
          <Scissors className="h-4 w-4" />
          {t('execute')}
        </button>
      </div>
    </div>
  );
}
