import api from './api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export type ContractStatus = 'DRAFT' | 'PENDING_SIGNATURES' | 'ACTIVE' | 'COMPLETED' | 'VOIDED';

export interface PaymentScheduleItem {
  milestoneName: string;
  amount:        number;
  percentage:    number;
  description:   string;
}

export interface Contract {
  id:                          string;
  jobId:                       string;
  investorId:                  string;
  contractorId:                string;
  bidId:                       string | null;
  status:                      ContractStatus;
  title:                       string;
  scopeOfWork:                 string;
  exclusions:                  string | null;
  investorResponsibilities:    string | null;
  contractorResponsibilities:  string | null;
  timelineEstimate:            string | null;
  timelineOverageClause:       string | null;
  disputeResolutionProcess:    string | null;
  paymentSchedule:             PaymentScheduleItem[];
  aiGenerated:                 boolean;
  aiModel:                     string | null;
  investorSignedAt:            string | null;
  contractorSignedAt:          string | null;
  investorIp:                  string | null;
  contractorIp:                string | null;
  fullText:                    string;
  createdAt:                   string;
  updatedAt:                   string;
}

export async function generateContract(jobId: string, bidId: string): Promise<Contract> {
  const { data: res } = await api.post<ApiResponse<Contract>>('/contracts/generate', { jobId, bidId });
  return res.data;
}

export async function getContractById(contractId: string): Promise<Contract> {
  const { data: res } = await api.get<ApiResponse<Contract>>(`/contracts/${contractId}`);
  return res.data;
}

export async function getContractByJob(jobId: string): Promise<Contract | null> {
  const { data: res } = await api.get<ApiResponse<Contract | null>>(`/contracts/by-job/${jobId}`);
  return res.data;
}

export async function signContract(contractId: string): Promise<Contract> {
  const { data: res } = await api.post<ApiResponse<Contract>>(`/contracts/${contractId}/sign`);
  return res.data;
}

export function getContractPdfUrl(contractId: string): string {
  const base = import.meta.env.VITE_API_URL ?? '';
  return `${base}/contracts/${contractId}/pdf`;
}
