'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Youtube,
  RefreshCw,
  Scissors,
  Combine,
  Layers,
  Sliders,
  Package,
  Radio,
  Terminal,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import type { TabId, TabDefinition } from '@/types/ui';

const TABS: TabDefinition[] = [
  { id: 'youtube', labelKey: 'tabs.youtube', icon: 'Youtube' },
  { id: 'convert', labelKey: 'tabs.convert', icon: 'RefreshCw' },
  { id: 'trim', labelKey: 'tabs.trim', icon: 'Scissors' },
  { id: 'merge', labelKey: 'tabs.merge', icon: 'Combine' },
  { id: 'extract', labelKey: 'tabs.extract', icon: 'Layers' },
  { id: 'filter', labelKey: 'tabs.filter', icon: 'Sliders' },
  { id: 'batch', labelKey: 'tabs.batch', icon: 'Package' },
  { id: 'stream', labelKey: 'tabs.stream', icon: 'Radio' },
  { id: 'command', labelKey: 'tabs.command', icon: 'Terminal' },
];

const ICON_MAP = {
  Youtube,
  RefreshCw,
  Scissors,
  Combine,
  Layers,
  Sliders,
  Package,
  Radio,
  Terminal,
} as const;

interface TabItemProps {
  tab: TabDefinition;
  isActive: boolean;
  onClick: () => void;
}

function TabItem({ tab, isActive, onClick }: TabItemProps) {
  const t = useTranslations();
  const Icon = ICON_MAP[tab.icon as keyof typeof ICON_MAP];

  return (
    <button
      onClick={onClick}
      className="relative flex h-12 items-center gap-1.5 px-3 text-sm transition-colors"
      style={{
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: isActive ? 500 : 400,
        whiteSpace: 'nowrap',
      }}
    >
      {/* Hover background */}
      <motion.div
        className="absolute inset-0 rounded-md"
        whileHover={{ backgroundColor: 'var(--bg-tertiary)' }}
        transition={{ duration: 0.1 }}
      />

      <Icon className="relative h-3.5 w-3.5 shrink-0" />
      <span className="relative">{t(tab.labelKey as Parameters<typeof t>[0])}</span>

      {/* Active underline indicator */}
      {isActive && (
        <motion.div
          layoutId="tab-indicator"
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
          style={{ backgroundColor: 'var(--accent-cyan)' }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
    </button>
  );
}

export function TabBar() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  return (
    <nav
      className="flex h-12 shrink-0 items-end overflow-x-auto px-2"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '0.5px solid var(--border-default)',
      }}
    >
      {TABS.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={activeTab === tab.id}
          onClick={() => setActiveTab(tab.id as TabId)}
        />
      ))}
    </nav>
  );
}
