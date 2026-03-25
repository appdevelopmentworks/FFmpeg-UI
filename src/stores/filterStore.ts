import { create } from 'zustand';
import type { AppliedFilter } from '@/lib/ffmpeg/filters';

interface FilterState {
  inputFile: string | null;
  filters: AppliedFilter[];
  selectedInstanceId: string | null;
  outputDir: string;
  outputFilename: string;
  commandPreview: string;
  // actions
  setInputFile: (path: string | null) => void;
  addFilter: (filter: AppliedFilter) => void;
  removeFilter: (instanceId: string) => void;
  updateFilterParam: (instanceId: string, key: string, value: number | string | boolean) => void;
  toggleFilter: (instanceId: string) => void;
  reorderFilters: (from: number, to: number) => void;
  setSelectedFilter: (instanceId: string | null) => void;
  setOutputDir: (dir: string) => void;
  setOutputFilename: (name: string) => void;
  setCommandPreview: (cmd: string) => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  inputFile: null,
  filters: [],
  selectedInstanceId: null,
  outputDir: '',
  outputFilename: '',
  commandPreview: '',

  setInputFile: (path) =>
    set({ inputFile: path, filters: [], selectedInstanceId: null, commandPreview: '' }),

  addFilter: (filter) =>
    set((state) => ({
      filters: [...state.filters, filter],
      selectedInstanceId: filter.instanceId,
    })),

  removeFilter: (instanceId) =>
    set((state) => ({
      filters: state.filters.filter((f) => f.instanceId !== instanceId),
      selectedInstanceId:
        state.selectedInstanceId === instanceId ? null : state.selectedInstanceId,
    })),

  updateFilterParam: (instanceId, key, value) =>
    set((state) => ({
      filters: state.filters.map((f) =>
        f.instanceId === instanceId
          ? { ...f, params: { ...f.params, [key]: value } }
          : f,
      ),
    })),

  toggleFilter: (instanceId) =>
    set((state) => ({
      filters: state.filters.map((f) =>
        f.instanceId === instanceId ? { ...f, enabled: !f.enabled } : f,
      ),
    })),

  reorderFilters: (from, to) =>
    set((state) => {
      const arr = [...state.filters];
      const [item] = arr.splice(from, 1);
      if (item) arr.splice(to, 0, item);
      return { filters: arr };
    }),

  setSelectedFilter: (instanceId) => set({ selectedInstanceId: instanceId }),

  setOutputDir: (dir) => set({ outputDir: dir }),

  setOutputFilename: (name) => set({ outputFilename: name }),

  setCommandPreview: (cmd) => set({ commandPreview: cmd }),

  clearFilters: () => set({ filters: [], selectedInstanceId: null, commandPreview: '' }),
}));
