'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePresetStore } from '@/stores/presetStore';

/**
 * Initializes app state on mount (loads settings, presets from Tauri backend)
 */
export function AppInitializer() {
  const loadSettings = useSettingsStore((s) => s.load);
  const loadPresets = usePresetStore((s) => s.load);

  useEffect(() => {
    // Load settings and apply theme
    loadSettings();
    loadPresets();
  }, [loadSettings, loadPresets]);

  return null;
}
