'use client';

import { useTranslations } from 'next-intl';
import { Package, Upload } from 'lucide-react';

export function BatchTab() {
  const t = useTranslations('batch');

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
          {t('dropMultiple')}
        </p>
        <button
          className="rounded-lg px-4 py-1.5 text-sm transition-colors"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '0.5px solid var(--border-default)',
          }}
        >
          {t('selectFolder')}
        </button>
      </div>

      {/* File list placeholder */}
      <div
        className="flex flex-1 flex-col rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <div
          className="flex items-center gap-2 p-3"
          style={{ borderBottom: '0.5px solid var(--border-default)' }}
        >
          <Package className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('fileList')}
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            ファイルなし
          </p>
        </div>
      </div>

      {/* Execute button */}
      <div className="flex justify-end">
        <button
          className="flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--accent-cyan-dim)',
            color: 'var(--accent-cyan)',
            border: '0.5px solid var(--accent-cyan)',
          }}
        >
          <Package className="h-4 w-4" />
          {t('execute')}
        </button>
      </div>
    </div>
  );
}
