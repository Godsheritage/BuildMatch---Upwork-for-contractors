import api from './api';
import type {
  JobPost, CreateJobPayload, JobListResult, JobListParams,
  Bid, BidWithContractor, CreateBidPayload,
} from '../types/job.types';

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

export async function cancelJob(id: string): Promise<JobPost> {
  const { data: res } = await api.delete<ApiResponse<JobPost>>(`/jobs/${id}`);
  return res.data;
}

// ── Bid service functions ──────────────────────────────────────────────────────

export async function createBid(jobId: string, payload: CreateBidPayload): Promise<Bid> {
  const { data: res } = await api.post<ApiResponse<Bid>>(`/jobs/${jobId}/bids`, payload);
  return res.data;
}

export async function getJobBids(jobId: string): Promise<BidWithContractor[]> {
  const { data: res } = await api.get<ApiResponse<BidWithContractor[]>>(`/jobs/${jobId}/bids`);
  return res.data;
}

export async function getMyBid(jobId: string): Promise<Bid> {
  const { data: res } = await api.get<ApiResponse<Bid>>(`/jobs/${jobId}/bids/my-bid`);
  return res.data;
}

export interface BidWithJob extends Bid {
  job: (JobPost & { investor: { firstName: string; lastName: string } }) | null;
}

export async function getMyBids(): Promise<BidWithJob[]> {
  const { data: res } = await api.get<ApiResponse<BidWithJob[]>>('/jobs/my-bids');
  return res.data;
}

export async function acceptBid(jobId: string, bidId: string): Promise<Bid> {
  const { data: res } = await api.put<ApiResponse<Bid>>(`/jobs/${jobId}/bids/${bidId}/accept`);
  return res.data;
}

export async function withdrawBid(jobId: string, bidId: string): Promise<Bid> {
  const { data: res } = await api.put<ApiResponse<Bid>>(`/jobs/${jobId}/bids/${bidId}/withdraw`);
  return res.data;
}
