'use client';

import { create } from 'zustand';
import type { VideoInfo, DownloadProgress } from '@/types/ytdlp';

type FetchState = 'idle' | 'loading' | 'success' | 'error';
type DownloadStatus = 'idle' | 'downloading' | 'complete' | 'error';

interface DownloadState {
  jobId: string | null;
  progress: DownloadProgress | null;
  outputPath: string | null;
  error: string | null;
  status: DownloadStatus;
}

interface YtDlpStore {
  url: string;
  fetchState: FetchState;
  videoInfo: VideoInfo | null;
  fetchError: string | null;
  selectedFormatId: string | null;
  outputDir: string;
  download: DownloadState;

  setUrl: (url: string) => void;
  setFetchState: (state: FetchState) => void;
  setVideoInfo: (info: VideoInfo | null) => void;
  setFetchError: (error: string | null) => void;
  setSelectedFormatId: (id: string | null) => void;
  setOutputDir: (dir: string) => void;
  startDownloadJob: (jobId: string) => void;
  updateDownloadProgress: (progress: DownloadProgress) => void;
  setDownloadComplete: (outputPath: string) => void;
  setDownloadError: (error: string) => void;
  resetDownload: () => void;
}

const INITIAL_DOWNLOAD: DownloadState = {
  jobId: null,
  progress: null,
  outputPath: null,
  error: null,
  status: 'idle',
};

export const useYtDlpStore = create<YtDlpStore>((set) => ({
  url: '',
  fetchState: 'idle',
  videoInfo: null,
  fetchError: null,
  selectedFormatId: null,
  outputDir: '',
  download: INITIAL_DOWNLOAD,

  setUrl: (url) => set({ url }),

  setFetchState: (fetchState) => set({ fetchState }),

  setVideoInfo: (videoInfo) =>
    set({
      videoInfo,
      fetchState: videoInfo ? 'success' : 'idle',
      fetchError: null,
      selectedFormatId: null,
    }),

  setFetchError: (error) =>
    set({ fetchError: error, fetchState: error ? 'error' : 'idle' }),

  setSelectedFormatId: (id) => set({ selectedFormatId: id }),

  setOutputDir: (dir) => set({ outputDir: dir }),

  startDownloadJob: (jobId) =>
    set({
      download: { ...INITIAL_DOWNLOAD, jobId, status: 'downloading' },
    }),

  updateDownloadProgress: (progress) =>
    set((s) => ({
      download: { ...s.download, progress },
    })),

  setDownloadComplete: (outputPath) =>
    set((s) => ({
      download: { ...s.download, status: 'complete', outputPath },
    })),

  setDownloadError: (error) =>
    set((s) => ({
      download: { ...s.download, status: 'error', error },
    })),

  resetDownload: () => set({ download: INITIAL_DOWNLOAD }),
}));
