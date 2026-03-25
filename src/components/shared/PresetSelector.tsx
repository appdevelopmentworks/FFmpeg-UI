'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, User, ChevronRight, Trash2 } from 'lucide-react';
import type { Preset, PresetCategory } from '@/types/preset';
import { BUILTIN_PRESETS, PRESET_CATEGORIES } from '@/lib/ffmpeg/presets';

interface PresetSelectorProps {
  onSelect: (preset: Preset) => void;
  onClose?: () => void;
  userPresets?: Preset[];
  onDeleteUserPreset?: (id: string) => void;
}

export function PresetSelector({
  onSelect,
  onClose,
  userPresets = [],
  onDeleteUserPreset,
}: PresetSelectorProps) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<'builtin' | 'user'>('builtin');
  const [activeCategory, setActiveCategory] = useState<PresetCategory>('web');

  const builtinByCategory = BUILTIN_PRESETS.filter(
    (p) => p.category === activeCategory,
  );

  const displayedPresets =
    activeTab === 'builtin'
      ? builtinByCategory
      : userPresets.filter((p) => p.category === activeCategory);

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '0.5px solid var(--border-default)',
        width: 360,
        maxHeight: 480,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '0.5px solid var(--border-default)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {t('presets.title')}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Builtin / User tabs */}
      <div
        className="flex"
        style={{ borderBottom: '0.5px solid var(--border-default)' }}
      >
        {(['builtin', 'user'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors"
            style={{
              color: activeTab === tab ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              borderBottom:
                activeTab === tab ? '1.5px solid var(--accent-cyan)' : '1.5px solid transparent',
            }}
          >
            {tab === 'builtin' ? (
              <Star size={12} />
            ) : (
              <User size={12} />
            )}
            {tab === 'builtin' ? t('presets.builtin') : t('presets.user')}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div
        className="flex gap-1 overflow-x-auto px-3 py-2"
        style={{ borderBottom: '0.5px solid var(--border-default)' }}
      >
        {PRESET_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className="shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors"
            style={{
              backgroundColor:
                activeCategory === cat.id ? 'var(--accent-cyan-dim)' : 'var(--bg-tertiary)',
              color:
                activeCategory === cat.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            }}
          >
            {(t as unknown as (k: string) => string)(cat.labelKey)}
          </button>
        ))}
      </div>

      {/* Preset list */}
      <div className="flex-1 overflow-y-auto">
        {displayedPresets.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {activeTab === 'user' ? t('presets.noUserPresets') : '—'}
            </span>
          </div>
        ) : (
          displayedPresets.map((preset) => (
            <div
              key={preset.id}
              className="group flex items-center gap-2 px-4 py-3 transition-colors"
              style={{ borderBottom: '0.5px solid var(--border-default)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor =
                  'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor = '';
              }}
            >
              <button
                className="flex flex-1 flex-col items-start gap-0.5 text-left"
                onClick={() => onSelect(preset)}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {preset.name}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {preset.description}
                </span>
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSelect(preset)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
                  style={{
                    backgroundColor: 'var(--accent-cyan-dim)',
                    color: 'var(--accent-cyan)',
                  }}
                >
                  {t('presets.apply')}
                  <ChevronRight size={11} />
                </button>
                {!preset.isBuiltin && onDeleteUserPreset && (
                  <button
                    onClick={() => onDeleteUserPreset(preset.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
                    style={{ color: 'var(--status-error)' }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
