'use client';

import { create } from 'zustand';
import type { Job, JobProgress } from '@/types/job';
import { cancelJob, pauseJob, resumeJob, reorderJobs } from '@/lib/tauri/commands';

interface JobStore {
  jobs: Job[];
  activeJobCount: number;

  // Mutations
  addJob: (job: Job) => void;
  updateJobProgress: (id: string, progress: JobProgress) => void;
  updateJobStatus: (id: string, updates: Partial<Job>) => void;
  removeJob: (id: string) => void;
  setJobs: (jobs: Job[]) => void;

  // Async operations
  cancelJob: (id: string) => Promise<void>;
  pauseJob: (id: string) => Promise<void>;
  resumeJob: (id: string) => Promise<void>;
  reorderJobs: (ids: string[]) => Promise<void>;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  activeJobCount: 0,

  addJob: (job) => {
    set((state) => {
      const jobs = [...state.jobs, job];
      return {
        jobs,
        activeJobCount: jobs.filter(
          (j) => j.status === 'running' || j.status === 'pending',
        ).length,
      };
    });
  },

  updateJobProgress: (id, progress) => {
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, progress } : j)),
    }));
  },

  updateJobStatus: (id, updates) => {
    set((state) => {
      const jobs = state.jobs.map((j) =>
        j.id === id ? { ...j, ...updates } : j,
      );
      return {
        jobs,
        activeJobCount: jobs.filter(
          (j) => j.status === 'running' || j.status === 'pending',
        ).length,
      };
    });
  },

  removeJob: (id) => {
    set((state) => {
      const jobs = state.jobs.filter((j) => j.id !== id);
      return {
        jobs,
        activeJobCount: jobs.filter(
          (j) => j.status === 'running' || j.status === 'pending',
        ).length,
      };
    });
  },

  setJobs: (jobs) => {
    set({
      jobs,
      activeJobCount: jobs.filter(
        (j) => j.status === 'running' || j.status === 'pending',
      ).length,
    });
  },

  cancelJob: async (id) => {
    try {
      await cancelJob(id);
      get().updateJobStatus(id, { status: 'cancelled' });
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  },

  pauseJob: async (id) => {
    try {
      await pauseJob(id);
      get().updateJobStatus(id, { status: 'paused' });
    } catch (error) {
      console.error('Failed to pause job:', error);
    }
  },

  resumeJob: async (id) => {
    try {
      await resumeJob(id);
      get().updateJobStatus(id, { status: 'running' });
    } catch (error) {
      console.error('Failed to resume job:', error);
    }
  },

  reorderJobs: async (ids) => {
    try {
      await reorderJobs(ids);
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
}));
