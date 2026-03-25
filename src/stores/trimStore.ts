'use client';

import { create } from 'zustand';
import type { MediaInfo } from '@/types/media';

type ProbeState = 'idle' | 'loading' | 'ready' | 'error';
type JobStatus = 'idle' | 'running' | 'complete' | 'error';

interface JobState {
  jobId: string | null;
  percent: number;
  speed: string;
  eta: string | null;
  status: JobStatus;
  outputPath: string | null;
  error: string | null;
}

interface TrimStore {
  filePath: string;
  mediaInfo: MediaInfo | null;
  thumbnails: string[];
  probeState: ProbeState;
  probeError: string | null;

  startTime: number;
  endTime: number;
  accurate: boolean;

  outputPath: string;
  job: JobState;

  setFilePath: (path: string) => void;
  setMediaInfo: (info: MediaInfo) => void;
  setThumbnails: (paths: string[]) => void;
  setProbeState: (state: ProbeState) => void;
  setProbeError: (err: string | null) => void;
  setStartTime: (t: number) => void;
  setEndTime: (t: number) => void;
  setAccurate: (v: boolean) => void;
  setOutputPath: (path: string) => void;
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

export const useTrimStore = create<TrimStore>((set) => ({
  filePath: '',
  mediaInfo: null,
  thumbnails: [],
  probeState: 'idle',
  probeError: null,
  startTime: 0,
  endTime: 0,
  accurate: false,
  outputPath: '',
  job: INITIAL_JOB,

  setFilePath: (filePath) => set({ filePath }),
  setMediaInfo: (info) => set({ mediaInfo: info, endTime: info.duration, startTime: 0 }),
  setThumbnails: (thumbnails) => set({ thumbnails }),
  setProbeState: (probeState) => set({ probeState }),
  setProbeError: (err) => set({ probeError: err }),
  setStartTime: (t) => set({ startTime: t }),
  setEndTime: (t) => set({ endTime: t }),
  setAccurate: (v) => set({ accurate: v }),
  setOutputPath: (outputPath) => set({ outputPath }),

  startJob: (jobId) => set({ job: { ...INITIAL_JOB, jobId, status: 'running' } }),
  updateJob: (percent, speed, eta) =>
    set((s) => ({ job: { ...s.job, percent, speed, eta } })),
  completeJob: (outputPath) =>
    set((s) => ({ job: { ...s.job, status: 'complete', outputPath, percent: 100 } })),
  failJob: (error) =>
    set((s) => ({ job: { ...s.job, status: 'error', error } })),
  resetJob: () => set({ job: INITIAL_JOB }),

  reset: () => set({
    filePath: '', mediaInfo: null, thumbnails: [], probeState: 'idle', probeError: null,
    startTime: 0, endTime: 0, accurate: false, outputPath: '', job: INITIAL_JOB,
  }),
}));
