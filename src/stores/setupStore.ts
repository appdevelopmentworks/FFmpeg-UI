'use client';

import { create } from 'zustand';
import type { SetupTool } from '@/hooks/useSetup';

export type SetupPhase = 'idle' | 'checking' | 'downloading' | 'ready' | 'error';
export type ToolPhase  = 'idle' | 'downloading' | 'complete' | 'error';

export interface ToolProgress {
  percent:    number;
  downloaded: number;
  total:      number;
}

export interface ToolStatus {
  phase:    ToolPhase;
  version:  string;
  path:     string;
  error:    string;
  progress: ToolProgress;
}

const defaultTool = (): ToolStatus => ({
  phase:    'idle',
  version:  '',
  path:     '',
  error:    '',
  progress: { percent: 0, downloaded: 0, total: 0 },
});

interface SetupStore {
  phase:         SetupPhase;
  ffmpegStatus:  ToolStatus;
  ytdlpStatus:   ToolStatus;

  setPhase:        (phase: SetupPhase) => void;
  setToolStatus:   (tool: SetupTool, phase: ToolPhase) => void;
  setToolProgress: (tool: SetupTool, progress: ToolProgress) => void;
  setToolError:    (tool: SetupTool, error: string) => void;
  setToolComplete: (tool: SetupTool, version: string, path: string) => void;
  reset:           () => void;
}

export const useSetupStore = create<SetupStore>((set) => ({
  phase:        'idle',
  ffmpegStatus: defaultTool(),
  ytdlpStatus:  defaultTool(),

  setPhase: (phase) => set({ phase }),

  setToolStatus: (tool, phase) =>
    set((s) => ({
      [tool === 'ffmpeg' ? 'ffmpegStatus' : 'ytdlpStatus']: {
        ...(tool === 'ffmpeg' ? s.ffmpegStatus : s.ytdlpStatus),
        phase,
      },
    })),

  setToolProgress: (tool, progress) =>
    set((s) => {
      const key    = tool === 'ffmpeg' ? 'ffmpegStatus' : 'ytdlpStatus';
      const status = tool === 'ffmpeg' ? s.ffmpegStatus : s.ytdlpStatus;
      return { [key]: { ...status, phase: 'downloading', progress } };
    }),

  setToolError: (tool, error) =>
    set((s) => {
      const key    = tool === 'ffmpeg' ? 'ffmpegStatus' : 'ytdlpStatus';
      const status = tool === 'ffmpeg' ? s.ffmpegStatus : s.ytdlpStatus;
      return { [key]: { ...status, phase: 'error', error } };
    }),

  setToolComplete: (tool, version, path) =>
    set((s) => {
      const key    = tool === 'ffmpeg' ? 'ffmpegStatus' : 'ytdlpStatus';
      const status = tool === 'ffmpeg' ? s.ffmpegStatus : s.ytdlpStatus;
      return {
        [key]: {
          ...status,
          phase:   'complete',
          version,
          path,
          error:   '',
          progress: { percent: 100, downloaded: status.progress.total, total: status.progress.total },
        },
      };
    }),

  reset: () =>
    set({
      phase:        'idle',
      ffmpegStatus: defaultTool(),
      ytdlpStatus:  defaultTool(),
    }),
}));
