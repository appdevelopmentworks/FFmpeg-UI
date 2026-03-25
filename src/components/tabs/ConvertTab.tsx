'use client';

import { useTranslations } from 'next-intl';
import { RefreshCw, Upload } from 'lucide-react';

export function ConvertTab() {
  const t = useTranslations('convert');

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Drop Zone */}
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-xl py-12 transition-colors"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px dashed var(--border-hover)',
        }}
      >
        <Upload className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('dropzone')}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('supportedFormats')}
        </p>
      </div>

      {/* Placeholder */}
      <div
        className="flex flex-1 items-center justify-center rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('startConversion')}
          </p>
        </div>
      </div>
    </div>
  );
}
