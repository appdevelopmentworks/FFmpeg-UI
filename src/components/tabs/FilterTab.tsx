'use client';

import { useTranslations } from 'next-intl';
import { Sliders, Upload } from 'lucide-react';

export function FilterTab() {
  const t = useTranslations('filter');

  return (
    <div className="flex h-full gap-4 p-6">
      {/* Left: Filter Catalog */}
      <div
        className="flex w-56 shrink-0 flex-col rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <div
          className="p-3"
          style={{ borderBottom: '0.5px solid var(--border-default)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('catalog')}
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('videoFilters')} / {t('audioFilters')}
          </p>
        </div>
      </div>

      {/* Center: Preview */}
      <div className="flex flex-1 flex-col gap-4">
        <div
          className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl"
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

        {/* Filter chain */}
        <div
          className="h-24 rounded-xl"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '0.5px solid var(--border-default)',
          }}
        >
          <div className="p-3">
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('chain')}
            </p>
          </div>
        </div>
      </div>

      {/* Right: Parameters */}
      <div
        className="flex w-56 shrink-0 flex-col rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <div
          className="p-3"
          style={{ borderBottom: '0.5px solid var(--border-default)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('parameters')}
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <Sliders className="h-6 w-6" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </div>
    </div>
  );
}
