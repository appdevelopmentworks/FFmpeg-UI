'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePresetStore } from '@/stores/presetStore';
import { SetupDialog } from '@/components/setup/SetupDialog';

/**
 * アプリ起動時の初期化処理と常設UIコンポーネントを管理する。
 * - 設定・プリセットのロード
 * - FFmpeg/yt-dlp バイナリのセットアップダイアログ
 */
export function AppInitializer() {
  const loadSettings = useSettingsStore((s) => s.load);
  const loadPresets  = usePresetStore((s) => s.load);

  useEffect(() => {
    loadSettings();
    loadPresets();
  }, [loadSettings, loadPresets]);

  return <SetupDialog />;
}
