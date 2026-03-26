'use client';

import { create } from 'zustand';
import type { TabId } from '@/types/ui';

interface UIStore {
  activeTab: TabId;
  jobQueueExpanded: boolean;
  setupDialogOpen: boolean;
  settingsOpen: boolean;

  // Actions
  setActiveTab: (tab: TabId) => void;
  toggleJobQueue: () => void;
  setJobQueueExpanded: (expanded: boolean) => void;
  setSetupDialogOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeTab: 'youtube',
  jobQueueExpanded: false,
  setupDialogOpen: false,
  settingsOpen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleJobQueue: () =>
    set((state) => ({ jobQueueExpanded: !state.jobQueueExpanded })),

  setJobQueueExpanded: (expanded) => set({ jobQueueExpanded: expanded }),

  setSetupDialogOpen: (open) => set({ setupDialogOpen: open }),

  setSettingsOpen: (open) => set({ settingsOpen: open }),
}));
