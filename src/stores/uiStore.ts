'use client';

import { create } from 'zustand';
import type { TabId } from '@/types/ui';

interface UIStore {
  activeTab: TabId;
  jobQueueExpanded: boolean;
  setupDialogOpen: boolean;

  // Actions
  setActiveTab: (tab: TabId) => void;
  toggleJobQueue: () => void;
  setJobQueueExpanded: (expanded: boolean) => void;
  setSetupDialogOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeTab: 'youtube',
  jobQueueExpanded: false,
  setupDialogOpen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleJobQueue: () =>
    set((state) => ({ jobQueueExpanded: !state.jobQueueExpanded })),

  setJobQueueExpanded: (expanded) => set({ jobQueueExpanded: expanded }),

  setSetupDialogOpen: (open) => set({ setupDialogOpen: open }),
}));
