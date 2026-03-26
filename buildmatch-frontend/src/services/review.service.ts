import api from './api';
import type { ContractorReviewsResult, CreateReviewPayload, Review } from '../types/review.types';
import type { JobPost } from '../types/job.types';

interface ApiResponse<T> { success: boolean; data: T; message?: string; }

export type ReviewSort = 'newest' | 'highest' | 'lowest';

export async function completeJob(jobId: string): Promise<JobPost> {
  const { data: res } = await api.post<ApiResponse<JobPost>>(`/jobs/${jobId}/complete`);
  return res.data;
}

export async function createReview(
  jobId: string,
  payload: CreateReviewPayload,
): Promise<Review> {
  const { data: res } = await api.post<ApiResponse<Review>>(`/jobs/${jobId}/reviews`, payload);
  return res.data;
}

export async function getContractorReviews(
  contractorUserId: string,
  params: { page?: number; limit?: number; sort?: ReviewSort } = {},
): Promise<ContractorReviewsResult> {
  const { data: res } = await api.get<ApiResponse<ContractorReviewsResult>>(
    `/contractors/${contractorUserId}/reviews`,
    { params },
  );
  return res.data;
}

export async function getJobReviews(jobId: string): Promise<Review[]> {
  const { data: res } = await api.get<ApiResponse<Review[]>>(`/jobs/${jobId}/reviews`);
  return res.data;
}
