'use client';

import { create } from 'zustand';

type ProbeState = 'idle' | 'loading' | 'ready' | 'error';
type JobStatus = 'idle' | 'running' | 'complete' | 'error';

export interface MergeFile {
  path: string;
  name: string;
  duration: number;
  size: number;
}

interface JobState {
  jobId: string | null;
  percent: number;
  speed: string;
  eta: string | null;
  status: JobStatus;
  outputPath: string | null;
  error: string | null;
}

interface MergeStore {
  files: MergeFile[];
  outputPath: string;
  probeState: ProbeState;
  job: JobState;

  addFiles: (files: MergeFile[]) => void;
  removeFile: (index: number) => void;
  moveFile: (from: number, to: number) => void;
  setOutputPath: (path: string) => void;
  setProbeState: (state: ProbeState) => void;

  startJob: (jobId: string) => void;
  updateJob: (percent: number, speed: string, eta: string | null) => void;
  completeJob: (outputPath: string) => void;
  failJob: (error: string) => void;
  resetJob: () => void;
  reset: () => void;
}

const INITIAL_JOB: JobState = {
  jobId: null, percent: 0, speed: '', eta: null, status: 'idle', outputPath: null, error: null,
};

export const useMergeStore = create<MergeStore>((set) => ({
  files: [],
  outputPath: '',
  probeState: 'idle',
  job: INITIAL_JOB,

  addFiles: (newFiles) => set((s) => ({ files: [...s.files, ...newFiles] })),
  removeFile: (index) => set((s) => ({
    files: s.files.filter((_, i) => i !== index),
  })),
  moveFile: (from, to) => set((s) => {
    if (from < 0 || from >= s.files.length || to < 0 || to >= s.files.length) return s;
    const files = [...s.files];
    const [item] = files.splice(from, 1);
    files.splice(to, 0, item);
    return { files };
  }),
  setOutputPath: (outputPath) => set({ outputPath }),
  setProbeState: (probeState) => set({ probeState }),

  startJob: (jobId) => set({ job: { ...INITIAL_JOB, jobId, status: 'running' } }),
  updateJob: (percent, speed, eta) =>
    set((s) => ({ job: { ...s.job, percent, speed, eta } })),
  completeJob: (outputPath) =>
    set((s) => ({ job: { ...s.job, status: 'complete', outputPath, percent: 100 } })),
  failJob: (error) =>
    set((s) => ({ job: { ...s.job, status: 'error', error } })),
  resetJob: () => set({ job: INITIAL_JOB }),

  reset: () => set({
    files: [], outputPath: '', probeState: 'idle', job: INITIAL_JOB,
  }),
}));
