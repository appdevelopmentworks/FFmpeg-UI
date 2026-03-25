'use client';

import { create } from 'zustand';
import type { Preset, PresetCategory } from '@/types/preset';

interface PresetStore {
  builtinPresets: Preset[];
  userPresets: Preset[];

  // Actions
  load: () => Promise<void>;
  addPreset: (preset: Preset) => void;
  updatePreset: (id: string, partial: Partial<Preset>) => void;
  deletePreset: (id: string) => void;
  importPresets: (json: string) => void;
  exportPresets: () => string;

  // Selectors
  getPresetsByCategory: (category: PresetCategory) => Preset[];
  getAllPresets: () => Preset[];
}

export const usePresetStore = create<PresetStore>((set, get) => ({
  builtinPresets: [],
  userPresets: [],

  load: async () => {
    try {
      const { getPresets } = await import('@/lib/tauri/commands');
      const presetList = await getPresets();
      set({
        builtinPresets: presetList.builtin,
        userPresets: presetList.user,
      });
    } catch {
      // Not in Tauri context
    }
  },

  addPreset: (preset) => {
    set((state) => ({ userPresets: [...state.userPresets, preset] }));
  },

  updatePreset: (id, partial) => {
    set((state) => ({
      userPresets: state.userPresets.map((p) =>
        p.id === id ? { ...p, ...partial } : p,
      ),
    }));
  },

  deletePreset: (id) => {
    set((state) => ({
      userPresets: state.userPresets.filter((p) => p.id !== id),
    }));
  },

  importPresets: (json) => {
    try {
      const presets = JSON.parse(json) as Preset[];
      set((state) => ({ userPresets: [...state.userPresets, ...presets] }));
    } catch (error) {
      console.error('Failed to import presets:', error);
    }
  },

  exportPresets: () => {
    return JSON.stringify(get().userPresets, null, 2);
  },

  getPresetsByCategory: (category) => {
    const state = get();
    return [
      ...state.builtinPresets.filter((p) => p.category === category),
      ...state.userPresets.filter((p) => p.category === category),
    ];
  },

  getAllPresets: () => {
    const state = get();
    return [...state.builtinPresets, ...state.userPresets];
  },
}));
