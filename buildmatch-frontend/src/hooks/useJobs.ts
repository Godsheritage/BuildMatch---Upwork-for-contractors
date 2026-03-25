import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { Job } from '../types/job.types';

async function getJobs(): Promise<Job[]> {
  const { data } = await api.get<Job[]>('/jobs');
  return data;
}

async function getJobById(id: string): Promise<Job> {
  const { data } = await api.get<Job>(`/jobs/${id}`);
  return data;
}

export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: getJobs,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => getJobById(id),
    enabled: !!id,
  });
}
