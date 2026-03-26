import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import type { TabId } from '@/types/ui';

const TAB_ORDER: TabId[] = [
  'youtube',
  'convert',
  'trim',
  'extract',
  'filter',
  'batch',
  'stream',
  'command',
];

/**
 * グローバルキーボードショートカット
 *
 * Ctrl+1〜8      : タブ切り替え
 * Ctrl+Tab       : 次のタブ
 * Ctrl+Shift+Tab : 前のタブ
 * Ctrl+O         : ファイルを開く（ファイルを扱うタブのみ有効）
 * Escape         : 設定モーダルを閉じる
 */
export function useKeyboardShortcuts() {
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const activeTab = useUIStore((s) => s.activeTab);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Escape: モーダルを閉じる
      if (e.key === 'Escape' && settingsOpen) {
        e.preventDefault();
        setSettingsOpen(false);
        return;
      }

      // テキスト入力中はタブ系ショートカットを無効化
      if (isTyping) return;

      // Ctrl+O: ファイルを開く（アクティブタブに file input があるときのみ）
      if (e.ctrlKey && e.key === 'o' && !e.shiftKey && !e.altKey) {
        const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
        if (fileInput) {
          e.preventDefault();
          fileInput.click();
        }
        return;
      }

      // Ctrl+1〜8: タブ切り替え
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 8) {
          e.preventDefault();
          const tab = TAB_ORDER[num - 1];
          if (tab) setActiveTab(tab);
          return;
        }
      }

      // Ctrl+Tab: 次のタブ
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const idx = TAB_ORDER.indexOf(activeTab);
        const next = TAB_ORDER[(idx + 1) % TAB_ORDER.length];
        if (next) setActiveTab(next);
        return;
      }

      // Ctrl+Shift+Tab: 前のタブ
      if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        const idx = TAB_ORDER.indexOf(activeTab);
        const prev = TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length];
        if (prev) setActiveTab(prev);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, setActiveTab, settingsOpen, setSettingsOpen]);
}
