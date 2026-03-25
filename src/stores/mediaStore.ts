'use client';

import { create } from 'zustand';
import type { MediaInfo, StreamInfo } from '@/types/media';
import type { VideoInfo } from '@/types/ytdlp';

interface MediaStore {
  currentMedia: MediaInfo | null;
  videoInfo: VideoInfo | null; // YouTube用
  streams: StreamInfo[];

  // Actions
  setMedia: (info: MediaInfo) => void;
  setVideoInfo: (info: VideoInfo) => void;
  clear: () => void;
  clearVideoInfo: () => void;
}

export const useMediaStore = create<MediaStore>((set) => ({
  currentMedia: null,
  videoInfo: null,
  streams: [],

  setMedia: (info) => {
    set({ currentMedia: info, streams: info.streams });
  },

  setVideoInfo: (info) => {
    set({ videoInfo: info });
  },

  clear: () => {
    set({ currentMedia: null, streams: [] });
  },

  clearVideoInfo: () => {
    set({ videoInfo: null });
  },
}));
