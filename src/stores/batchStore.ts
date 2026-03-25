import { create } from 'zustand';

export interface BatchFile {
  id: string;
  path: string;
  filename: string;
  size: number;
  format: string;
  selected: boolean;
  status: 'pending' | 'processing' | 'done' | 'error';
  jobId?: string;
  error?: string;
  progress?: number;
}

export interface BatchSettings {
  operation: 'convert' | 'extract_audio';
  container: string;
  videoCodec: string;
  audioCodec: string;
  resolution: string;
  filenameTemplate: string;
  parallelJobs: number;
  outputDir: string;
}

interface BatchState {
  files: BatchFile[];
  settings: BatchSettings;
  isRunning: boolean;
  completedCount: number;
  // actions
  addFiles: (paths: string[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  updateSettings: (settings: Partial<BatchSettings>) => void;
  setFileStatus: (id: string, status: BatchFile['status'], error?: string) => void;
  setFileJobId: (id: string, jobId: string) => void;
  setFileProgress: (id: string, progress: number) => void;
  setRunning: (running: boolean) => void;
  incrementCompleted: () => void;
  reset: () => void;
}

const defaultSettings: BatchSettings = {
  operation: 'convert',
  container: 'mp4',
  videoCodec: 'libx264',
  audioCodec: 'aac',
  resolution: 'original',
  filenameTemplate: '{name}_converted',
  parallelJobs: 2,
  outputDir: '',
};

export const useBatchStore = create<BatchState>((set) => ({
  files: [],
  settings: { ...defaultSettings },
  isRunning: false,
  completedCount: 0,

  addFiles: (paths) =>
    set((state) => {
      const existing = new Set(state.files.map((f) => f.path));
      const newFiles: BatchFile[] = paths
        .filter((p) => !existing.has(p))
        .map((p) => {
          const parts = p.replace(/\\/g, '/').split('/');
          const filename = parts[parts.length - 1] ?? p;
          const extMatch = filename.match(/\.([^.]+)$/);
          return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            path: p,
            filename,
            size: 0,
            format: extMatch ? extMatch[1].toUpperCase() : '?',
            selected: true,
            status: 'pending',
          };
        });
      return { files: [...state.files, ...newFiles] };
    }),

  removeFile: (id) =>
    set((state) => ({ files: state.files.filter((f) => f.id !== id) })),

  clearFiles: () => set({ files: [], completedCount: 0 }),

  toggleSelect: (id) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f)),
    })),

  selectAll: () =>
    set((state) => ({ files: state.files.map((f) => ({ ...f, selected: true })) })),

  deselectAll: () =>
    set((state) => ({ files: state.files.map((f) => ({ ...f, selected: false })) })),

  updateSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),

  setFileStatus: (id, status, error) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, status, error } : f)),
    })),

  setFileJobId: (id, jobId) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, jobId } : f)),
    })),

  setFileProgress: (id, progress) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, progress } : f)),
    })),

  setRunning: (running) => set({ isRunning: running }),

  incrementCompleted: () =>
    set((state) => ({ completedCount: state.completedCount + 1 })),

  reset: () =>
    set({
      files: [],
      settings: { ...defaultSettings },
      isRunning: false,
      completedCount: 0,
    }),
}));
