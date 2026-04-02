import api from './api';

// ── Response wrapper ───────────────────────────────────────────────────────────
function data<T>(res: { data: { success: boolean; data: T } }): T {
  return res.data.data;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type DrawScheduleStatus = 'DRAFT' | 'NEGOTIATING' | 'PENDING_APPROVAL' | 'LOCKED';
export type DrawMilestoneStatus = 'PENDING' | 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DISPUTED' | 'RELEASED';
export type DrawRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISPUTED';

export interface DrawEvidence {
  id:           string;
  drawRequestId:string;
  milestoneId:  string;
  uploadedById: string;
  url:          string;
  caption:      string | null;
  createdAt:    string;
}

export interface DrawRequest {
  id:              string;
  milestoneId:     string;
  jobId:           string;
  contractorId:    string;
  contractor:      { id: string; firstName: string; lastName: string };
  amount:          number;
  note:            string | null;
  status:          DrawRequestStatus;
  reviewedById:    string | null;
  reviewedBy:      { id: string; firstName: string; lastName: string } | null;
  reviewedAt:      string | null;
  rejectionReason: string | null;
  createdAt:       string;
  evidence:        DrawEvidence[];
}

export interface DrawMilestone {
  id:                 string;
  scheduleId:         string;
  jobId:              string;
  drawNumber:         number;
  title:              string;
  description:        string;
  completionCriteria: string;
  percentage:         number;
  amount:             number;
  status:             DrawMilestoneStatus;
  requestedAt:        string | null;
  approvedAt:         string | null;
  releasedAt:         string | null;
  dueDate:            string | null;
  createdAt:          string;
  drawRequests:       DrawRequest[];
}

export interface DrawSchedule {
  id:                   string;
  jobId:                string;
  status:               DrawScheduleStatus;
  totalAmount:          number;
  drawCount:            number;
  aiGenerated:          boolean;
  investorApprovedAt:   string | null;
  contractorApprovedAt: string | null;
  lockedAt:             string | null;
  createdAt:            string;
  updatedAt:            string;
  milestones:           DrawMilestone[];
}

export interface AiMilestone {
  drawNumber:         number;
  title:              string;
  description:        string;
  completionCriteria: string;
  percentage:         number;
}

export interface AiPreviewResult {
  milestones:  AiMilestone[];
  reasoning?:  string;
  aiGenerated: boolean;
  fallback?:   boolean;
}

export interface CreateMilestoneInput {
  drawNumber:         number;
  title:              string;
  description:        string;
  completionCriteria: string;
  percentage:         number;
  amount:             number;
  dueDate?:           string;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const previewDrawSchedule = (jobId: string, totalAmount: number): Promise<AiPreviewResult> =>
  api.get(`/draws/jobs/${jobId}/preview`, { params: { totalAmount } }).then(data);

export const getDrawSchedule = (jobId: string): Promise<DrawSchedule> =>
  api.get(`/draws/jobs/${jobId}`).then(data);

export const createDrawSchedule = (
  jobId: string,
  payload: { totalAmount: number; aiGenerated: boolean; milestones: CreateMilestoneInput[] },
): Promise<DrawSchedule> =>
  api.post(`/draws/jobs/${jobId}`, payload).then(data);

export const updateMilestone = (
  jobId: string,
  milestoneId: string,
  payload: Partial<Omit<CreateMilestoneInput, 'drawNumber'>>,
): Promise<DrawMilestone> =>
  api.patch(`/draws/jobs/${jobId}/milestones/${milestoneId}`, payload).then(data);

export const approveDrawSchedule = (jobId: string): Promise<DrawSchedule> =>
  api.post(`/draws/jobs/${jobId}/approve`).then(data);

export const submitDrawRequest = (
  jobId: string,
  milestoneId: string,
  note?: string,
): Promise<DrawRequest> =>
  api.post(`/draws/jobs/${jobId}/milestones/${milestoneId}/request`, { note }).then(data);

export const reviewDrawRequest = (
  jobId: string,
  requestId: string,
  action: 'APPROVE' | 'REJECT',
  rejectionReason?: string,
): Promise<DrawRequest> =>
  api.post(`/draws/jobs/${jobId}/requests/${requestId}/review`, { action, rejectionReason }).then(data);

export const addDrawEvidence = (
  jobId: string,
  requestId: string,
  payload: { url: string; caption?: string },
): Promise<DrawEvidence> =>
  api.post(`/draws/jobs/${jobId}/requests/${requestId}/evidence`, payload).then(data);

export const getDrawRequests = (jobId: string): Promise<DrawRequest[]> =>
  api.get(`/draws/jobs/${jobId}/requests`).then(data);
