'use client';

import { create } from 'zustand';
import type { Job, JobProgress, JobType, JobStatus } from '@/types/job';
import {
  cancelJob as cancelJobCmd,
  pauseJob as pauseJobCmd,
  resumeJob as resumeJobCmd,
  reorderJobs as reorderJobsCmd,
  clearCompletedJobs,
  getJobs,
} from '@/lib/tauri/commands';
import { onQueueUpdated } from '@/lib/tauri/events';

// ── 型 ───────────────────────────────────────────────────────────────────────

// Rust の JobEntry (進捗なし) を Job にマップ
interface RawJobEntry {
  id: string;
  jobType: JobType;
  status: JobStatus;
  inputPath: string;
  outputPath: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

function mapEntry(e: RawJobEntry, existing?: Job): Job {
  return {
    id: e.id,
    jobType: e.jobType,
    status: e.status,
    inputPath: e.inputPath,
    outputPath: e.outputPath,
    createdAt: e.createdAt,
    startedAt: e.startedAt,
    completedAt: e.completedAt,
    error: e.error,
    // 既存の進捗を保持する (イベントで更新済みの場合)
    progress: existing?.progress,
  };
}

function countActive(jobs: Job[]): number {
  return jobs.filter((j) => j.status === 'running' || j.status === 'pending').length;
}

// ── ストア ───────────────────────────────────────────────────────────────────

interface JobStore {
  jobs: Job[];
  activeJobCount: number;

  // ローカル変異
  addJob: (job: Job) => void;
  updateJobProgress: (id: string, progress: JobProgress) => void;
  updateJobStatus: (id: string, updates: Partial<Job>) => void;
  removeJob: (id: string) => void;
  /** Rust イベントから受け取ったジョブ一覧で上書き (進捗は保持) */
  setJobs: (jobs: RawJobEntry[]) => void;

  // 非同期操作
  cancelJob: (id: string) => Promise<void>;
  pauseJob: (id: string) => Promise<void>;
  resumeJob: (id: string) => Promise<void>;
  reorderJobs: (ids: string[]) => Promise<void>;
  clearCompleted: () => Promise<void>;

  /** `job:queue-updated` イベントとポーリングを開始し、解除関数を返す */
  initListeners: () => Promise<() => void>;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  activeJobCount: 0,

  addJob: (job) => {
    set((state) => {
      const jobs = [...state.jobs, job];
      return { jobs, activeJobCount: countActive(jobs) };
    });
  },

  updateJobProgress: (id, progress) => {
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, progress } : j)),
    }));
  },

  updateJobStatus: (id, updates) => {
    set((state) => {
      const jobs = state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j));
      return { jobs, activeJobCount: countActive(jobs) };
    });
  },

  removeJob: (id) => {
    set((state) => {
      const jobs = state.jobs.filter((j) => j.id !== id);
      return { jobs, activeJobCount: countActive(jobs) };
    });
  },

  setJobs: (rawJobs) => {
    set((state) => {
      const progressMap = new Map(state.jobs.map((j) => [j.id, j.progress]));
      const jobs = rawJobs.map((e) => mapEntry(e, { ...e, progress: progressMap.get(e.id) } as Job));
      return { jobs, activeJobCount: countActive(jobs) };
    });
  },

  cancelJob: async (id) => {
    try {
      await cancelJobCmd(id);
      get().updateJobStatus(id, { status: 'cancelled' });
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  },

  pauseJob: async (id) => {
    try {
      await pauseJobCmd(id);
      get().updateJobStatus(id, { status: 'paused' });
    } catch (error) {
      console.error('Failed to pause job:', error);
    }
  },

  resumeJob: async (id) => {
    try {
      await resumeJobCmd(id);
      get().updateJobStatus(id, { status: 'running' });
    } catch (error) {
      console.error('Failed to resume job:', error);
    }
  },

  reorderJobs: async (ids) => {
    try {
      await reorderJobsCmd(ids);
      const currentJobs = get().jobs;
      const reordered = ids
        .map((id) => currentJobs.find((j) => j.id === id))
        .filter(Boolean) as Job[];
      const rest = currentJobs.filter((j) => !ids.includes(j.id));
      set({ jobs: [...reordered, ...rest] });
    } catch (error) {
      console.error('Failed to reorder jobs:', error);
    }
  },

  clearCompleted: async () => {
    try {
      await clearCompletedJobs();
      set((state) => {
        const jobs = state.jobs.filter(
          (j) => j.status !== 'completed' && j.status !== 'failed' && j.status !== 'cancelled',
        );
        return { jobs, activeJobCount: countActive(jobs) };
      });
    } catch (error) {
      console.error('Failed to clear completed jobs:', error);
    }
  },

  initListeners: async () => {
    // 初回ロード
    try {
      const initial = await getJobs();
      get().setJobs(initial as unknown as RawJobEntry[]);
    } catch {
      // Tauri 未接続 (開発環境など) では無視
    }

    // リアルタイム更新
    const unlisten = await onQueueUpdated((jobs) => {
      get().setJobs(jobs as unknown as RawJobEntry[]);
    });

    return unlisten;
  },
}));
