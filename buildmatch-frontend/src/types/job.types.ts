// ── Legacy type (kept for placeholder components) ─────────────────────────────
/** @deprecated Use JobPost instead */
export interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  budget: number;
  tradeType: string;
  status: string;
  clientId: string;
  postedAt: string;
}

// ── Backend-aligned types ─────────────────────────────────────────────────────

export type JobStatus = 'OPEN' | 'AWARDED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type TradeType =
  | 'GENERAL' | 'ELECTRICAL' | 'PLUMBING' | 'HVAC' | 'ROOFING'
  | 'FLOORING' | 'PAINTING' | 'LANDSCAPING' | 'DEMOLITION' | 'OTHER';

export interface JobPost {
  id: string;
  title: string;
  description: string;
  tradeType: TradeType;
  budgetMin: number;
  budgetMax: number;
  city: string;
  state: string;
  zipCode: string;
  status: JobStatus;
  investorId: string;
  investor: { firstName: string; lastName: string };
  bidCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobPayload {
  title: string;
  description: string;
  tradeType: TradeType;
  budgetMin: number;
  budgetMax: number;
  city: string;
  state: string;
  zipCode: string;
}

export interface JobListResult {
  jobs: JobPost[];
  total: number;
  page: number;
  totalPages: number;
}

export interface JobListParams {
  page?: number;
  limit?: number;
  tradeType?: TradeType;
  state?: string;
  city?: string;
  minBudget?: number;
  maxBudget?: number;
  status?: JobStatus;
  search?: string;
}
