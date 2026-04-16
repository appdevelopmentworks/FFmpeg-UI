'use client';

import { Header } from '@/components/layout/Header';
import { TabBar } from '@/components/layout/TabBar';
import { JobQueueFooter } from '@/components/layout/JobQueueFooter';
import { YouTubeTab } from '@/components/tabs/YouTubeTab';
import { ConvertTab } from '@/components/tabs/ConvertTab';
import { TrimTab } from '@/components/tabs/TrimTab';
import { MergeTab } from '@/components/tabs/MergeTab';
import { ExtractTab } from '@/components/tabs/ExtractTab';
import { FilterTab } from '@/components/tabs/FilterTab';
import { BatchTab } from '@/components/tabs/BatchTab';
import { StreamTab } from '@/components/tabs/StreamTab';
import { CommandTab } from '@/components/tabs/CommandTab';
import { useUIStore } from '@/stores/uiStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { AnimatePresence, motion } from 'framer-motion';

const TAB_CONTENT = {
  youtube: YouTubeTab,
  convert: ConvertTab,
  trim: TrimTab,
  merge: MergeTab,
  extract: ExtractTab,
  filter: FilterTab,
  batch: BatchTab,
  stream: StreamTab,
  command: CommandTab,
} as const;

export default function Home() {
  const activeTab = useUIStore((s) => s.activeTab);
  const ActiveTabComponent = TAB_CONTENT[activeTab];
  useKeyboardShortcuts();

  return (
    <div
      className="flex h-screen flex-col"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Header: 56px */}
      <Header />

      {/* Tab Bar: 48px */}
      <TabBar />

      {/* Main Content Area */}
      <main
        className="relative flex-1 overflow-hidden"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="h-full overflow-y-auto"
          >
            <ActiveTabComponent />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Job Queue Footer: 48px (collapsible) */}
      <JobQueueFooter />
    </div>
  );
}
