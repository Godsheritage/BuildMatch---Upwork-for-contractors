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
  photos: string[];
  status: JobStatus;
  investorId: string;
  investor: { firstName: string; lastName: string };
  bidCount: number;
  createdAt: string;
  updatedAt: string;
  /** Present on detail endpoint when caller is authenticated */
  hasBid?: boolean;
  isCompleted?: boolean;
  reviewsUnlocked?: boolean;
}

// ── Bid types ─────────────────────────────────────────────────────────────────

export type BidStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

export interface Bid {
  id: string;
  jobId: string;
  contractorId: string;
  amount: number;
  message: string;
  status: BidStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BidWithContractor extends Bid {
  contractor: {
    userId: string;
    city: string | null;
    state: string | null;
    specialties: string[];
    averageRating: number;
    totalReviews: number;
    yearsExperience: number;
    isAvailable: boolean;
    user: { firstName: string; lastName: string };
  } | null;
}

export interface CreateBidPayload {
  amount: number;
  message: string;
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
  photos?: string[];
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

// ── Message types ─────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  jobId: string;
  senderId: string;
  sender: { firstName: string; lastName: string; role: string };
  body: string;
  isAiGenerated: boolean;
  createdAt: string;
}
