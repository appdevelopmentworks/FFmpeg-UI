'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sliders,
  Upload,
  Plus,
  X,
  Eye,
  EyeOff,
  ChevronRight,
  Film,
  Music,
  GripVertical,
  Loader2,
} from 'lucide-react';
import { useFilterStore } from '@/stores/filterStore';
import {
  VIDEO_FILTERS,
  AUDIO_FILTERS,
  getFilterById,
  buildFilterChain,
  type FilterDefinition,
  type AppliedFilter,
} from '@/lib/ffmpeg/filters';
import { executeFFmpeg, openFileDialog, probeMedia } from '@/lib/tauri/commands';
import type { FFmpegCommand } from '@/types/ffmpeg';

// ── Helpers ───────────────────────────────────────────────────────────────────

function newInstance(def: FilterDefinition): AppliedFilter {
  const params: Record<string, number | string | boolean> = {};
  for (const p of def.params) params[p.key] = p.default;
  return {
    instanceId: `${def.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    filterId: def.id,
    enabled: true,
    params,
  };
}

function filterDisplayName(def: FilterDefinition, t: ReturnType<typeof useTranslations>): string {
  if (def.nameKey.startsWith('_')) return def.nameKey.slice(1);
  try {
    return t(def.nameKey as Parameters<typeof t>[0]);
  } catch {
    return def.nameKey;
  }
}

function paramLabel(labelKey: string): string {
  return labelKey.startsWith('_') ? labelKey.slice(1) : labelKey;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterCatalog({
  onAdd,
}: {
  onAdd: (def: FilterDefinition) => void;
}) {
  const t = useTranslations('filter');
  const [category, setCategory] = useState<'video' | 'audio'>('video');
  const list = category === 'video' ? VIDEO_FILTERS : AUDIO_FILTERS;

  return (
    <div
      className="flex w-56 shrink-0 flex-col rounded-xl"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '0.5px solid var(--border-default)',
      }}
    >
      {/* Category tabs */}
      <div
        className="flex p-1 gap-1"
        style={{ borderBottom: '0.5px solid var(--border-default)' }}
      >
        {(['video', 'audio'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all"
            style={{
              backgroundColor:
                category === cat
                  ? 'color-mix(in srgb, var(--accent-cyan) 12%, transparent)'
                  : 'transparent',
              color: category === cat ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            }}
          >
            {cat === 'video' ? <Film className="h-3 w-3" /> : <Music className="h-3 w-3" />}
            {cat === 'video' ? t('videoFilters') : t('audioFilters')}
          </button>
        ))}
      </div>

      <p className="px-3 pt-2 pb-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
        {t('catalog')}
      </p>

      {/* Filter list */}
      <div className="flex flex-1 flex-col overflow-y-auto pb-2">
        {list.map((def) => (
          <button
            key={def.id}
            onClick={() => onAdd(def)}
            className="flex items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-white/[0.04]"
            style={{ color: 'var(--text-primary)' }}
          >
            <span>{filterDisplayName(def, t)}</span>
            <Plus className="h-3 w-3 shrink-0 opacity-40" />
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterChainItem({
  applied,
  isSelected,
  def,
  onSelect,
  onRemove,
  onToggle,
  t,
}: {
  applied: AppliedFilter;
  isSelected: boolean;
  def: FilterDefinition | undefined;
  onSelect: () => void;
  onRemove: () => void;
  onToggle: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const name = def ? filterDisplayName(def, t) : applied.filterId;
  const filterString = def ? def.buildArgs(applied.params) : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-white/[0.03]"
      style={{
        borderBottom: '0.5px solid var(--border-default)',
        backgroundColor: isSelected ? 'color-mix(in srgb, var(--accent-cyan) 6%, transparent)' : undefined,
      }}
      onClick={onSelect}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-30" style={{ color: 'var(--text-tertiary)' }} />

      {/* Enable toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="shrink-0"
        title={applied.enabled ? 'Disable' : 'Enable'}
      >
        {applied.enabled
          ? <Eye className="h-3.5 w-3.5" style={{ color: 'var(--accent-cyan)' }} />
          : <EyeOff className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
        }
      </button>

      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-medium truncate"
          style={{
            color: applied.enabled ? 'var(--text-primary)' : 'var(--text-tertiary)',
          }}
        >
          {name}
        </p>
        {filterString && (
          <p className="text-[10px] truncate font-mono" style={{ color: 'var(--text-tertiary)' }}>
            {filterString}
          </p>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="shrink-0 opacity-40 hover:opacity-80 transition-opacity"
      >
        <X className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
      </button>
    </motion.div>
  );
}

function ParamEditor({
  applied,
  def,
  onUpdate,
}: {
  applied: AppliedFilter;
  def: FilterDefinition;
  onUpdate: (key: string, value: number | string | boolean) => void;
}) {
  const t = useTranslations('filter');
  const name = filterDisplayName(def, t);

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
        {name}
      </p>

      {def.params.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          No parameters
        </p>
      )}

      {def.params.map((param) => {
        const value = applied.params[param.key] ?? param.default;

        return (
          <div key={param.key} className="space-y-1.5">
            <label className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span>{paramLabel(param.labelKey)}</span>
              {param.type === 'number' && (
                <span style={{ color: 'var(--accent-cyan)' }}>
                  {value}{param.unit ? ` ${param.unit}` : ''}
                </span>
              )}
            </label>

            {param.type === 'number' && (
              <div className="flex gap-2 items-center">
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={param.step ?? 1}
                  value={Number(value)}
                  onChange={(e) => onUpdate(param.key, Number(e.target.value))}
                  className="flex-1 accent-[var(--accent-cyan)]"
                />
                <input
                  type="number"
                  min={param.min}
                  max={param.max}
                  step={param.step ?? 1}
                  value={Number(value)}
                  onChange={(e) => onUpdate(param.key, Number(e.target.value))}
                  className="w-16 rounded px-1.5 py-1 text-xs text-right outline-none"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    border: '0.5px solid var(--border-default)',
                  }}
                />
              </div>
            )}

            {param.type === 'select' && (
              <select
                value={String(value)}
                onChange={(e) => onUpdate(param.key, e.target.value)}
                className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '0.5px solid var(--border-default)',
                }}
              >
                {param.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {param.type === 'boolean' && (
              <button
                onClick={() => onUpdate(param.key, !value)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-all"
                style={{
                  backgroundColor: value ? 'color-mix(in srgb, var(--accent-cyan) 12%, transparent)' : 'var(--bg-tertiary)',
                  color: value ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  border: `0.5px solid ${value ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
                }}
              >
                {String(value)}
              </button>
            )}

            {param.type === 'string' && (
              <input
                type="text"
                value={String(value)}
                onChange={(e) => onUpdate(param.key, e.target.value)}
                className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '0.5px solid var(--border-default)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FilterTab() {
  const t = useTranslations('filter');
  const tCommon = useTranslations('common');

  const {
    inputFile,
    filters,
    selectedInstanceId,
    outputDir,
    outputFilename,
    commandPreview,
    setInputFile,
    addFilter,
    removeFilter,
    updateFilterParam,
    toggleFilter,
    setSelectedFilter,
    setOutputDir,
    setOutputFilename,
    setCommandPreview,
    clearFilters,
  } = useFilterStore();

  const [isDragOver, setIsDragOver] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [mediaInfo, setMediaInfo] = useState<{ filename: string; duration?: number } | null>(null);

  const selectedApplied = filters.find((f) => f.instanceId === selectedInstanceId);
  const selectedDef = selectedApplied ? getFilterById(selectedApplied.filterId) : undefined;

  // Update command preview whenever filter chain changes
  useEffect(() => {
    if (!inputFile) {
      setCommandPreview('');
      return;
    }
    const chain = buildFilterChain(filters);
    if (!chain) {
      setCommandPreview(`ffmpeg -i "${inputFile}" [no filters] output`);
      return;
    }
    const out = outputFilename
      ? `"${outputDir ? `${outputDir}/` : ''}${outputFilename}"`
      : '"output.mp4"';
    setCommandPreview(`ffmpeg -i "${inputFile}" -vf "${chain}" ${out}`);
  }, [filters, inputFile, outputDir, outputFilename, setCommandPreview]);

  const handleAddFilter = useCallback(
    (def: FilterDefinition) => {
      addFilter(newInstance(def));
    },
    [addFilter],
  );

  const handleSelectFile = async () => {
    try {
      const paths = await openFileDialog(
        'Select Media File',
        [{ name: 'Media', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'mp3', 'wav', 'flac'] }],
        false,
        false,
      );
      if (paths && paths.length > 0) {
        const p = paths[0];
        setInputFile(p);
        const parts = p.replace(/\\/g, '/').split('/');
        const fname = parts[parts.length - 1] ?? p;
        const base = fname.replace(/\.[^.]+$/, '');
        setOutputFilename(`${base}_filtered`);
        try {
          const info = await probeMedia(p);
          setMediaInfo({ filename: fname, duration: info.duration });
        } catch {
          setMediaInfo({ filename: fname });
        }
      }
    } catch (err) {
      console.error('File dialog error:', err);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && files[0]) {
      setInputFile(files[0].name);
      setOutputFilename(files[0].name.replace(/\.[^.]+$/, '') + '_filtered');
    }
  };

  const handleApply = async () => {
    if (!inputFile || filters.filter((f) => f.enabled).length === 0) return;

    setIsApplying(true);
    try {
      const out = `${outputDir ? `${outputDir}/` : ''}${outputFilename || 'output'}.mp4`;

      const filterSpecs = filters
        .map((f, idx) => {
          const def = getFilterById(f.filterId);
          if (!def) return null;
          return {
            id: f.instanceId,
            name: def.ffmpegFilter,
            displayName: def.nameKey,
            category: def.category as import('@/types/ffmpeg').FilterCategory,
            params: Object.fromEntries(Object.entries(f.params).map(([k, v]) => [k, String(v)])),
            enabled: f.enabled,
            order: idx,
          };
        })
        .filter((f): f is NonNullable<typeof f> => f !== null);

      const command: FFmpegCommand = {
        inputPath: inputFile,
        outputPath: out,
        videoCodec: 'libx264',
        audioCodec: 'aac',
        container: 'mp4',
        filters: filterSpecs,
        extraArgs: [],
        twoPass: false,
        copyVideo: false,
        copyAudio: false,
        noVideo: false,
        noAudio: false,
      };

      await executeFFmpeg(command);
    } catch (err) {
      console.error('Filter apply error:', err);
    } finally {
      setIsApplying(false);
    }
  };

  const handleSelectOutputDir = async () => {
    try {
      const paths = await openFileDialog('Select Output Directory', [], false, true);
      if (paths && paths.length > 0) setOutputDir(paths[0]);
    } catch (err) {
      console.error('Dir dialog error:', err);
    }
  };

  const enabledCount = filters.filter((f) => f.enabled).length;

  return (
    <div className="flex h-full gap-4 p-6">
      {/* ── Left: Filter Catalog ───────────────────────────────────────────── */}
      <FilterCatalog onAdd={handleAddFilter} />

      {/* ── Center: Preview + Chain + Preview ─────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-3 min-w-0">
        {/* File drop zone */}
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-colors"
          style={{
            backgroundColor: isDragOver ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
            border: isDragOver ? '1px dashed var(--accent-cyan)' : '1px dashed var(--border-hover)',
          }}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={handleSelectFile}
        >
          <Upload className="h-5 w-5 shrink-0" style={{ color: inputFile ? 'var(--accent-cyan)' : 'var(--text-tertiary)' }} />
          <div className="flex-1 min-w-0">
            {inputFile ? (
              <>
                <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {mediaInfo?.filename ?? inputFile.split(/[\\/]/).pop()}
                </p>
                {mediaInfo?.duration != null && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {Math.floor(mediaInfo.duration / 60)}m {Math.floor(mediaInfo.duration % 60)}s
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('dropzone')}
              </p>
            )}
          </div>
          {inputFile && (
            <button
              onClick={(e) => { e.stopPropagation(); setInputFile(null); setMediaInfo(null); clearFilters(); }}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>

        {/* Filter Chain */}
        <div
          className="flex flex-1 flex-col rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '0.5px solid var(--border-default)',
          }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ borderBottom: '0.5px solid var(--border-default)' }}
          >
            <p className="flex-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('chain')}
              {filters.length > 0 && (
                <span className="ml-2" style={{ color: 'var(--text-tertiary)' }}>
                  ({enabledCount}/{filters.length})
                </span>
              )}
            </p>
            {filters.length > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs opacity-50 hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('deleteAll')}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filters.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6">
                <p className="text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {t('addHint')}
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filters.map((applied) => {
                  const def = getFilterById(applied.filterId);
                  return (
                    <FilterChainItem
                      key={applied.instanceId}
                      applied={applied}
                      isSelected={applied.instanceId === selectedInstanceId}
                      def={def}
                      onSelect={() => setSelectedFilter(applied.instanceId)}
                      onRemove={() => removeFilter(applied.instanceId)}
                      onToggle={() => toggleFilter(applied.instanceId)}
                      t={t}
                    />
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Command Preview */}
        {commandPreview && (
          <div
            className="rounded-xl p-3"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '0.5px solid var(--border-default)',
            }}
          >
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {t('preview')}
            </p>
            <p className="font-mono text-xs break-all" style={{ color: 'var(--accent-cyan)' }}>
              {commandPreview}
            </p>
          </div>
        )}

        {/* Output + Apply */}
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {tCommon('filename')}
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={outputFilename}
                onChange={(e) => setOutputFilename(e.target.value)}
                placeholder="output_filtered"
                className="flex-1 rounded-lg px-2.5 py-2 text-xs outline-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '0.5px solid var(--border-default)',
                }}
              />
              <button
                onClick={handleSelectOutputDir}
                className="shrink-0 rounded-lg px-2.5 py-2 text-xs transition-colors hover:opacity-80"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  border: '0.5px solid var(--border-default)',
                }}
                title={tCommon('outputDir')}
              >
                📁
              </button>
            </div>
          </div>

          <button
            onClick={handleApply}
            disabled={!inputFile || enabledCount === 0 || isApplying}
            className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all"
            style={{
              backgroundColor:
                !inputFile || enabledCount === 0 || isApplying
                  ? 'var(--bg-tertiary)'
                  : 'color-mix(in srgb, var(--accent-cyan) 15%, transparent)',
              color:
                !inputFile || enabledCount === 0 || isApplying
                  ? 'var(--text-tertiary)'
                  : 'var(--accent-cyan)',
              border:
                !inputFile || enabledCount === 0 || isApplying
                  ? '0.5px solid var(--border-default)'
                  : '0.5px solid var(--accent-cyan)',
            }}
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tCommon('loading')}
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4" />
                {t('apply')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Right: Parameters ──────────────────────────────────────────────── */}
      <div
        className="flex w-56 shrink-0 flex-col rounded-xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        <div
          className="flex items-center gap-2 p-3"
          style={{ borderBottom: '0.5px solid var(--border-default)' }}
        >
          <Sliders className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('parameters')}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedApplied && selectedDef ? (
            <ParamEditor
              applied={selectedApplied}
              def={selectedDef}
              onUpdate={(key, value) => updateFilterParam(selectedApplied.instanceId, key, value)}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4">
              <p className="text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('selectHint')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
