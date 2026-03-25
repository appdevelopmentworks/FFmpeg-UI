'use client';

import { create } from 'zustand';
import type { AppSettings, ThemeMode, AppLocale } from '@/types/settings';

const DEFAULT_SETTINGS: AppSettings = {
  outputDir: '',
  duplicateAction: 'ask',
  maxParallelJobs: 2,
  theme: 'dark',
  locale: 'ja',
  notifications: true,
  ffmpegPath: undefined,
  ytdlpPath: undefined,
  filenameTemplate: '{name}_{date}',
};

interface SettingsStore extends AppSettings {
  isLoaded: boolean;

  // Actions
  load: () => Promise<void>;
  save: () => Promise<void>;
  update: (partial: Partial<AppSettings>) => void;
  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: AppLocale) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  isLoaded: false,

  load: async () => {
    try {
      // Dynamic import to avoid SSR issues
      const { getSettings } = await import('@/lib/tauri/commands');
      const settings = await getSettings();
      set({ ...settings, isLoaded: true });
    } catch {
      // Not in Tauri context (dev mode), use defaults
      set({ isLoaded: true });
    }
  },

  save: async () => {
    try {
      const { updateSettings } = await import('@/lib/tauri/commands');
      const state = get();
      const settings: AppSettings = {
        outputDir: state.outputDir,
        duplicateAction: state.duplicateAction,
        maxParallelJobs: state.maxParallelJobs,
        theme: state.theme,
        locale: state.locale,
        notifications: state.notifications,
        ffmpegPath: state.ffmpegPath,
        ytdlpPath: state.ytdlpPath,
        filenameTemplate: state.filenameTemplate,
      };
      await updateSettings(settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  },

  update: (partial) => {
    set(partial);
  },

  setTheme: (theme) => {
    set({ theme });
    // Apply theme to document
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else if (theme === 'light') {
        root.classList.remove('dark');
        root.classList.add('light');
      } else {
        // System preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
        root.classList.toggle('light', !prefersDark);
      }
    }
  },

  setLocale: (locale) => {
    set({ locale });
  },
}));
