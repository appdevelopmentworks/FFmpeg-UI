'use client';

import { useTranslations } from 'next-intl';
import { Layers, Upload } from 'lucide-react';

export function ExtractTab() {
  const t = useTranslations('extract');

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

      {/* Streams placeholder */}
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <Layers className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('streams')}
        </p>
      </div>
    </div>
  );
}
