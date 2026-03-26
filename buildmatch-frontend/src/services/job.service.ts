import api from './api';
import type { JobPost, CreateJobPayload, JobListResult, JobListParams } from '../types/job.types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function createJob(payload: CreateJobPayload): Promise<JobPost> {
  const { data: res } = await api.post<ApiResponse<JobPost>>('/jobs', payload);
  return res.data;
}

export async function getJobs(params: JobListParams = {}): Promise<JobListResult> {
  const { data: res } = await api.get<ApiResponse<JobListResult>>('/jobs', { params });
  return res.data;
}

export async function getJobById(id: string): Promise<JobPost> {
  const { data: res } = await api.get<ApiResponse<JobPost>>(`/jobs/${id}`);
  return res.data;
}

export async function getMyJobs(): Promise<JobPost[]> {
  const { data: res } = await api.get<ApiResponse<JobPost[]>>('/jobs/my-jobs');
  return res.data;
}
