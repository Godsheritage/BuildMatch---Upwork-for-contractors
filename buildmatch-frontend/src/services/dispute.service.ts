import api from './api';
import type {
  Dispute,
  DisputeEvidence,
  DisputeListResult,
  DisputeMessage,
  DisputeSummary,
  DisputeCategory,
  EvidenceType,
} from '../types/dispute.types';

interface ApiResponse<T> {
  success: boolean;
  data:    T;
  message?: string;
}

export async function getDisputes(params: {
  status?: string;
  page:    number;
  limit:   number;
}): Promise<DisputeListResult> {
  const { data: res } = await api.get<ApiResponse<DisputeListResult>>('/disputes', { params });
  return res.data;
}

export async function getDisputeById(disputeId: string): Promise<Dispute> {
  const { data: res } = await api.get<ApiResponse<Dispute>>(`/disputes/${disputeId}`);
  return res.data;
}

export async function getDisputeMessages(disputeId: string): Promise<DisputeMessage[]> {
  const { data: res } = await api.get<ApiResponse<{ messages: DisputeMessage[] }>>(
    `/disputes/${disputeId}/messages`,
  );
  return res.data.messages;
}

export async function getDisputeEvidence(disputeId: string): Promise<DisputeEvidence[]> {
  const { data: res } = await api.get<ApiResponse<{ evidence: DisputeEvidence[] }>>(
    `/disputes/${disputeId}/evidence`,
  );
  return res.data.evidence;
}

export async function getDisputeSummary(): Promise<DisputeSummary> {
  const { data: res } = await api.get<ApiResponse<DisputeSummary>>('/disputes/summary');
  return res.data;
}

export async function fileDispute(input: {
  jobId:          string;
  milestoneDraw?: number;
  amountDisputed: number;
  category:       DisputeCategory;
  description:    string;
  desiredOutcome: string;
}): Promise<Dispute> {
  const { data: res } = await api.post<ApiResponse<Dispute>>('/disputes', input);
  return res.data;
}

export async function addDisputeMessage(
  disputeId: string,
  content:   string,
): Promise<DisputeMessage> {
  const { data: res } = await api.post<ApiResponse<DisputeMessage>>(
    `/disputes/${disputeId}/messages`,
    { content },
  );
  return res.data;
}

export async function submitEvidence(
  disputeId: string,
  evidence: { type: EvidenceType; url?: string; description: string },
): Promise<DisputeEvidence> {
  const { data: res } = await api.post<ApiResponse<DisputeEvidence>>(
    `/disputes/${disputeId}/evidence`,
    evidence,
  );
  return res.data;
}

export async function withdrawDispute(
  disputeId: string,
  reason:    string,
): Promise<void> {
  await api.post(`/disputes/${disputeId}/withdraw`, { reason });
}
