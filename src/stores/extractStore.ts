'use client';

import { create } from 'zustand';
import type { MediaInfo } from '@/types/media';

type ProbeState = 'idle' | 'loading' | 'ready' | 'error';
type JobStatus = 'idle' | 'running' | 'complete' | 'error';

export interface StreamSelection {
  streamIndex: number;
  selected: boolean;
  outputFormat: string;
  options: Record<string, string>;
}

interface JobState {
  jobId: string | null;
  percent: number;
  speed: string;
  status: JobStatus;
  outputDir: string | null;
  error: string | null;
}

interface ExtractStore {
  filePath: string;
  mediaInfo: MediaInfo | null;
  probeState: ProbeState;
  probeError: string | null;
  selections: StreamSelection[];
  outputDir: string;
  job: JobState;

  setFilePath: (path: string) => void;
  setMediaInfo: (info: MediaInfo) => void;
  setProbeState: (state: ProbeState) => void;
  setProbeError: (err: string | null) => void;
  setSelections: (selections: StreamSelection[]) => void;
  updateSelection: (index: number, patch: Partial<StreamSelection>) => void;
  setOutputDir: (dir: string) => void;
  startJob: (jobId: string) => void;
  updateJob: (percent: number, speed: string) => void;
  completeJob: (outputDir: string) => void;
  failJob: (error: string) => void;
  resetJob: () => void;
  reset: () => void;
}

const INITIAL_JOB: JobState = {
  jobId: null, percent: 0, speed: '', status: 'idle', outputDir: null, error: null,
};

const DEFAULT_FORMAT: Record<string, string> = {
  video: 'mp4',
  audio: 'mp3',
  subtitle: 'srt',
  data: 'bin',
};

export const useExtractStore = create<ExtractStore>((set) => ({
  filePath: '',
  mediaInfo: null,
  probeState: 'idle',
  probeError: null,
  selections: [],
  outputDir: '',
  job: INITIAL_JOB,

  setFilePath: (filePath) => set({ filePath }),

  setMediaInfo: (info) => {
    const selections: StreamSelection[] = info.streams
      .filter((s) => s.streamType !== 'data')
      .map((s) => ({
        streamIndex: s.index,
        selected: s.streamType === 'video' || s.streamType === 'audio',
        outputFormat: DEFAULT_FORMAT[s.streamType] ?? 'bin',
        options: {},
      }));
    set({ mediaInfo: info, selections });
  },

  setProbeState: (probeState) => set({ probeState }),
  setProbeError: (err) => set({ probeError: err }),
  setSelections: (selections) => set({ selections }),

  updateSelection: (index, patch) =>
    set((s) => ({
      selections: s.selections.map((sel, i) =>
        i === index ? { ...sel, ...patch } : sel,
      ),
    })),

  setOutputDir: (outputDir) => set({ outputDir }),

  startJob: (jobId) => set({ job: { ...INITIAL_JOB, jobId, status: 'running' } }),
  updateJob: (percent, speed) =>
    set((s) => ({ job: { ...s.job, percent, speed } })),
  completeJob: (outputDir) =>
    set((s) => ({ job: { ...s.job, status: 'complete', outputDir, percent: 100 } })),
  failJob: (error) =>
    set((s) => ({ job: { ...s.job, status: 'error', error } })),
  resetJob: () => set({ job: INITIAL_JOB }),

  reset: () => set({
    filePath: '', mediaInfo: null, probeState: 'idle', probeError: null,
    selections: [], outputDir: '', job: INITIAL_JOB,
  }),
}));
