import api from './api';

interface ApiResponse<T> { success: boolean; data: T; }

export interface MilestoneInput {
  title:       string;
  description?: string;
  percentage:  number;
}

export interface Milestone {
  id:               string;
  escrowPaymentId:  string;
  title:            string;
  description:      string | null;
  percentage:       number;
  amount:           number;
  order:            number;
  status:           string;
  completionNotes:  string | null;
  stripeTransferId: string | null;
  disputeReason:    string | null;
  approvedAt:       string | null;
  releasedAt:       string | null;
}

export interface EscrowPayment {
  id:                     string;
  jobId:                  string;
  investorId:             string;
  contractorId:           string;
  totalAmount:            number;
  platformFeeAmount:      number;
  stripePaymentIntentId:  string | null;
  status:                 string;
  milestones:             Milestone[];
  createdAt:              string;
  updatedAt:              string;
}

export async function fundJob(
  jobId: string,
  milestones: MilestoneInput[],
): Promise<{ clientSecret: string; escrowPayment: EscrowPayment }> {
  const { data: res } = await api.post<ApiResponse<{ clientSecret: string; escrowPayment: EscrowPayment }>>(
    `/escrow/fund-job/${jobId}`,
    { milestones },
  );
  return res.data;
}

export async function getEscrow(jobId: string): Promise<EscrowPayment> {
  const { data: res } = await api.get<ApiResponse<EscrowPayment>>(`/escrow/${jobId}`);
  return res.data;
}

export async function submitMilestone(
  jobId: string,
  milestoneId: string,
  completionNotes?: string,
): Promise<Milestone> {
  const { data: res } = await api.post<ApiResponse<Milestone>>(
    `/escrow/${jobId}/milestones/${milestoneId}/submit`,
    { completionNotes },
  );
  return res.data;
}

export async function approveMilestone(jobId: string, milestoneId: string): Promise<Milestone> {
  const { data: res } = await api.post<ApiResponse<Milestone>>(
    `/escrow/${jobId}/milestones/${milestoneId}/approve`,
  );
  return res.data;
}

export async function disputeMilestone(
  jobId: string,
  milestoneId: string,
  reason: string,
): Promise<Milestone> {
  const { data: res } = await api.post<ApiResponse<Milestone>>(
    `/escrow/${jobId}/milestones/${milestoneId}/dispute`,
    { reason },
  );
  return res.data;
}
