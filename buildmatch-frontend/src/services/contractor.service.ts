import api from './api';
import type { Contractor, ContractorProfile, UpdateProfilePayload } from '../types/contractor.types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ContractorListParams {
  search?: string;
  state?: string;
  city?: string;
  minRating?: number;
  available?: true;       // pass only `true`; omit to show all
  limit?: number;
  page?: number;
}

export interface ContractorListResult {
  contractors: ContractorProfile[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getContractors(
  params: ContractorListParams = {},
): Promise<ContractorListResult> {
  const { data: res } = await api.get<ApiResponse<ContractorListResult>>('/contractors', {
    params: { limit: 50, ...params },
  });
  return res.data;
}

// Legacy — kept for components still using the old Contractor shape
export async function getContractorsLegacy(): Promise<Contractor[]> {
  const { data } = await api.get<Contractor[]>('/contractors');
  return data;
}

export async function getContractorById(id: string): Promise<ContractorProfile> {
  const { data: res } = await api.get<ApiResponse<ContractorProfile>>(`/contractors/${id}`);
  return res.data;
}

export async function updateMyProfile(payload: UpdateProfilePayload): Promise<ContractorProfile> {
  const { data: res } = await api.put<ApiResponse<ContractorProfile>>('/contractors/me', payload);
  return res.data;
}
