import { create } from 'zustand';

export type StreamStatus = 'idle' | 'connecting' | 'connected' | 'recording' | 'error';
export type StreamProtocol = 'auto' | 'rtmp' | 'hls' | 'dash' | 'http';

export interface StreamInfo {
  url: string;
  videoCodec?: string;
  audioCodec?: string;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
  duration?: number;
}

interface StreamState {
  url: string;
  protocol: StreamProtocol;
  status: StreamStatus;
  streamInfo: StreamInfo | null;
  error: string | null;
  jobId: string | null;
  // recording settings
  outputFormat: string;
  outputDir: string;
  durationLimit: number; // 0 = no limit (seconds)
  // actions
  setUrl: (url: string) => void;
  setProtocol: (protocol: StreamProtocol) => void;
  setStatus: (status: StreamStatus) => void;
  setStreamInfo: (info: StreamInfo | null) => void;
  setError: (error: string | null) => void;
  setJobId: (jobId: string | null) => void;
  setOutputFormat: (format: string) => void;
  setOutputDir: (dir: string) => void;
  setDurationLimit: (seconds: number) => void;
  reset: () => void;
}

export const useStreamStore = create<StreamState>((set) => ({
  url: '',
  protocol: 'auto',
  status: 'idle',
  streamInfo: null,
  error: null,
  jobId: null,
  outputFormat: 'mp4',
  outputDir: '',
  durationLimit: 0,

  setUrl: (url) => set({ url }),
  setProtocol: (protocol) => set({ protocol }),
  setStatus: (status) => set({ status }),
  setStreamInfo: (info) => set({ streamInfo: info }),
  setError: (error) => set({ error }),
  setJobId: (jobId) => set({ jobId }),
  setOutputFormat: (format) => set({ outputFormat: format }),
  setOutputDir: (dir) => set({ outputDir: dir }),
  setDurationLimit: (seconds) => set({ durationLimit: seconds }),
  reset: () =>
    set({
      url: '',
      protocol: 'auto',
      status: 'idle',
      streamInfo: null,
      error: null,
      jobId: null,
    }),
}));
