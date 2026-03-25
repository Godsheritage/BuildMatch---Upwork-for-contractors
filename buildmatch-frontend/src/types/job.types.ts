export type JobStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export type TradeType =
  | 'plumbing'
  | 'electrical'
  | 'carpentry'
  | 'painting'
  | 'hvac'
  | 'roofing'
  | 'landscaping'
  | 'general';

export interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  budget: number;
  tradeType: TradeType;
  status: JobStatus;
  clientId: string;
  postedAt: string;
}
