export type DisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'AWAITING_EVIDENCE'
  | 'PENDING_RULING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'WITHDRAWN';

export type DisputeCategory =
  | 'INCOMPLETE_WORK'
  | 'WORK_NOT_STARTED'
  | 'QUALITY_ISSUES'
  | 'TIMELINE_BREACH'
  | 'PAYMENT_DISPUTE'
  | 'SCOPE_CREEP'
  | 'COMMUNICATION_BREAKDOWN'
  | 'OTHER';

export type DisputeRuling =
  | 'INVESTOR_WINS'
  | 'CONTRACTOR_WINS'
  | 'SPLIT'
  | 'WITHDRAWN'
  | 'NO_ACTION';

export type EvidenceType =
  | 'PHOTO'
  | 'VIDEO'
  | 'DOCUMENT'
  | 'SCREENSHOT'
  | 'OTHER';

export interface Dispute {
  id:             string;
  jobId:          string;
  jobTitle:       string;
  filedById:      string;
  againstId:      string;
  milestoneDraw:  number | null;
  amountDisputed: number;
  category:       DisputeCategory;
  description:    string;
  desiredOutcome: string;
  status:         DisputeStatus;
  ruling:         DisputeRuling | null;
  rulingNote:     string | null;
  resolvedAt:     string | null;
  lastActivityAt: string;
  createdAt:      string;
  filedBy: { id: string; firstName: string; lastName: string; avatarUrl: string | null; role: string };
  against: { id: string; firstName: string; lastName: string; avatarUrl: string | null; role: string };
  evidenceCount:  number;
  messageCount:   number;
}

export interface DisputeEvidence {
  id:          string;
  disputeId:   string;
  submittedBy: string;
  type:        EvidenceType;
  url:         string | null;
  description: string;
  createdAt:   string;
}

export interface DisputeMessage {
  id:           string;
  disputeId:    string;
  senderId:     string;
  senderName:   string;
  senderAvatar: string | null;
  content:      string;
  isSystem:     boolean;
  createdAt:    string;
}

export interface FileDisputeInput {
  jobId:          string;
  milestoneDraw?: number;
  amountDisputed: number;
  category:       DisputeCategory;
  description:    string;
  desiredOutcome: string;
}
