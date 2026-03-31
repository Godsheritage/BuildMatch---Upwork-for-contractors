import api from './api';

// ── Response wrappers ─────────────────────────────────────────────────────────

function data<T>(res: { data: { success: boolean; data: T } }): T {
  return res.data.data;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PageResponse<T> {
  data:       T[];
  total:      number;
  page:       number;
  totalPages: number;
  limit:      number;
}

export interface PlatformStats {
  users:       { total: number; investors: number; contractors: number; admins: number; newLast7d: number; newLast30d: number; active: number };
  jobs:        { total: number; open: number; awarded: number; inProgress: number; completed: number; cancelled: number };
  contractors: { total: number; available: number; licenseVerified: number };
  disputes:    { total: number; open: number; underReview: number; resolved: number };
}

export interface RecentActivityItem {
  type:      'user_signup' | 'job_posted' | 'dispute_filed';
  label:     string;
  sublabel:  string;
  id:        string;
  createdAt: string;
}

export interface AdminUser {
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; isVerified: boolean;
  isBanned: boolean; suspendedUntil: string | null;
  avatarUrl: string | null; createdAt: string; jobCount: number; bidCount: number;
  // detail only:
  phone?: string | null; city?: string | null; state?: string | null;
  company?: string | null;
  contractor?: { id: string; specialties: string[]; averageRating: number; completedJobs: number; isLicenseVerified: boolean; isAvailable: boolean } | null;
  recentJobs?: { id: string; title: string; status: string; createdAt: string }[];
}

export interface ContractorSummary {
  id: string; specialties: string[]; averageRating: number; completedJobs: number;
  reliabilityScore: number; isLicenseVerified: boolean; isAvailable: boolean;
  city: string | null; state: string | null; hourlyRateMin: number | null; hourlyRateMax: number | null;
}

export interface AdminUserFullProfile {
  // base
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; isVerified: boolean;
  isBanned: boolean; suspendedUntil: string | null;
  avatarUrl: string | null; bidCount: number;
  phone: string | null; city: string | null; state: string | null;
  company: string | null; title: string | null; website: string | null; bio: string | null;
  createdAt: string; updatedAt: string; lastSignInAt: string | null;
  // finance
  totalSpend: number; totalEarnings: number; platformFeesPaid: number;
  // counts
  jobCount: number; messageFilterCount: number;
  // relations
  contractor: ContractorSummary | null;
  jobs:    { id: string; title: string; status: string; budgetMin: number; budgetMax: number; createdAt: string }[];
  bids:    { id: string; jobId: string; jobTitle: string; amount: number; status: string; createdAt: string }[];
  recentMessages: { id: string; conversationId: string; content: string; isFiltered: boolean; createdAt: string }[];
  reviews: { id: string; rating: number; title: string; body: string; reviewerRole: string; createdAt: string }[];
  disputes: { id: string; status: string; category: string; createdAt: string; filedById: string; againstId: string }[];
  accountStatusHistory: { action: string; adminId: string; note: string | null; createdAt: string }[];
}

export interface FlaggedUser {
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; isBanned: boolean; avatarUrl: string | null;
  createdAt: string; severityScore: number; filterCount: number; disputeCount: number; reasons: string[];
}

export interface AdminContractor {
  profileId: string; userId: string; firstName: string; lastName: string; email: string;
  city: string | null; state: string | null; specialties: string[];
  averageRating: number; completedJobs: number; isAvailable: boolean;
  isLicenseVerified: boolean; reliabilityScore: number; createdAt: string;
}

export interface AdminJob {
  id: string; title: string; tradeType: string; status: string;
  city: string; state: string; budgetMin: number; budgetMax: number;
  bidCount: number; photoCount: number; videoCount: number;
  investorId: string; investorName: string;
  disputeCount: number; isFeatured: boolean; isFlagged: boolean;
  createdAt: string;
}

export interface AdminJobBid {
  id: string; contractorId: string; contractorName: string; contractorAvatar: string | null;
  amount: number; status: string; createdAt: string;
}

export interface AdminJobConversationPreview {
  id: string; contractorId: string; contractorName: string;
  lastMessageAt: string | null; messageCount: number; lastMessage: string | null;
}

export interface AdminJobEscrow {
  id: string; totalAmount: number; platformFeeAmount: number;
  status: string; stripePaymentIntentId: string | null;
  milestones: {
    id: string; title: string; amount: number; percentage: number;
    order: number; status: string; releasedAt: string | null; approvedAt: string | null;
  }[];
  createdAt: string;
}

export interface AdminJobDetail extends AdminJob {
  description: string; zipCode: string; photos: string[]; flaggedReason: string | null;
  bids: AdminJobBid[];
  conversations: AdminJobConversationPreview[];
  disputes: { id: string; status: string; category: string; filedById: string; againstId: string; createdAt: string }[];
  escrow: AdminJobEscrow | null;
  statusTimeline: { action: string; adminId: string | null; note: string | null; payload: Record<string, unknown>; createdAt: string }[];
}

export interface ContentQueueItem {
  id: string; title: string; tradeType: string; status: string;
  city: string; state: string; investorId: string; investorName: string;
  flaggedReason: string | null; bidCount: number; createdAt: string;
}

export interface AdminDispute {
  id: string; jobId: string; jobTitle: string; filedById: string; filedByName: string;
  againstId: string; againstName: string; status: string; category: string;
  amountDisputed: number; createdAt: string; lastActivityAt: string;
}

export interface AdminDisputeDetail {
  id: string; jobId: string; jobTitle: string; filedById: string; againstId: string;
  status: string; ruling: string | null; rulingNote: string | null;
  amountDisputed: number; category: string; description: string; desiredOutcome: string;
  resolvedAt: string | null; lastActivityAt: string; createdAt: string;
  filedBy: { id: string; firstName: string; lastName: string; avatarUrl: string | null; role: string };
  against: { id: string; firstName: string; lastName: string; avatarUrl: string | null; role: string };
  evidenceCount: number; messageCount: number;
}

export interface AuditLogEntry {
  id: string; adminId: string; action: string;
  targetType: string; targetId: string;
  payload: Record<string, unknown> | null;
  ipAddress: string | null; note: string | null;
  createdAt: string;
}

export interface PlatformSetting {
  key: string; value: unknown; description: string | null;
  updatedBy: string | null; updatedAt: string;
}

export interface FeatureFlag {
  key: string; enabled: boolean; rolloutPct: number;
  description: string | null; updatedBy: string | null; updatedAt: string;
}

export interface BannedEmail {
  email: string; bannedAt: string; bannedBy: string | null; reason: string | null;
}

// ── Overview (new richer endpoints) ───────────────────────────────────────────

export interface OverviewStats {
  users:      { total: number; investors: number; contractors: number; newToday: number; newThisWeek: number; newThisMonth: number };
  jobs:       { total: number; open: number; inProgress: number; completedThisMonth: number; postedToday: number };
  finance:    { totalGmv: number; gmvThisMonth: number; platformRevenueTotal: number; platformRevenueThisMonth: number; fundsInEscrow: number; avgJobValue: number };
  disputes:   { open: number; resolvedThisMonth: number };
  moderation: { queueSize: number };
}

export interface ActivityEvent {
  type:        'user_signup' | 'job_posted' | 'bid_submitted' | 'dispute_filed' | 'message_filtered';
  description: string;
  userId:      string;
  userName:    string;
  link:        string;
  createdAt:   string;
}

export interface OverviewAlert {
  severity:  'critical' | 'warning' | 'info';
  type:      string;
  message:   string;
  link:      string;
  createdAt: string;
}

export const getOverviewStats    = () => api.get('/admin/overview/stats').then(data<OverviewStats>);
export const getOverviewActivity = () => api.get('/admin/overview/activity').then(data<{ events: ActivityEvent[] }>);
export const getOverviewAlerts   = () => api.get('/admin/overview/alerts').then(data<{ alerts: OverviewAlert[] }>);

// ── Stats ─────────────────────────────────────────────────────────────────────

export const getStats      = () => api.get('/admin/stats').then(data<PlatformStats>);
export const getActivity   = () => api.get('/admin/stats/activity').then(data<RecentActivityItem[]>);

// ── Users ─────────────────────────────────────────────────────────────────────

export const getUsers = (params: Record<string, unknown>) =>
  api.get('/admin/users', { params }).then(data<PageResponse<AdminUser>>);

export const getUserById = (id: string) =>
  api.get(`/admin/users/${id}`).then(data<AdminUser>);

export const getUserFullProfile = (id: string) =>
  api.get(`/admin/users/${id}`).then(data<AdminUserFullProfile>);

export const getFlaggedUsers = () =>
  api.get('/admin/users/flagged').then(data<{ users: FlaggedUser[] }>);

export const banUser   = (id: string) => api.put(`/admin/users/${id}/ban`);
export const unbanUser = (id: string) => api.put(`/admin/users/${id}/unban`);

export const suspendUser = (id: string, reason: string, durationDays?: number | null) =>
  api.post(`/admin/users/${id}/suspend`, { reason, durationDays: durationDays ?? null });

export const unsuspendUser = (id: string) =>
  api.post(`/admin/users/${id}/unsuspend`);

export const banUserPost = (id: string, reason: string) =>
  api.post(`/admin/users/${id}/ban`, { reason });

export const verifyContractorUser = (id: string) =>
  api.post(`/admin/users/${id}/verify-contractor`);

export const impersonateUser = (id: string) =>
  api.post(`/admin/users/${id}/impersonate`).then(data<{ token: string; userEmail: string; userRole: string }>);

export const sendAdminMessage = (id: string, subject: string, content: string) =>
  api.post(`/admin/users/${id}/send-message`, { subject, content });

export const changeUserRole = (id: string, role: string, note?: string) =>
  api.put(`/admin/users/${id}/role`, { role, note });

// ── Contractors ───────────────────────────────────────────────────────────────

export const getContractors = (params: Record<string, unknown>) =>
  api.get('/admin/contractors', { params }).then(data<PageResponse<AdminContractor>>);

export const verifyLicense   = (profileId: string) =>
  api.put(`/admin/contractors/${profileId}/verify-license`);
export const unverifyLicense = (profileId: string) =>
  api.put(`/admin/contractors/${profileId}/unverify-license`);
export const setAvailability = (profileId: string, isAvailable: boolean) =>
  api.put(`/admin/contractors/${profileId}/availability`, { isAvailable });

// ── Jobs ──────────────────────────────────────────────────────────────────────

export const getJobs = (params: Record<string, unknown>) =>
  api.get('/admin/jobs', { params }).then(data<PageResponse<AdminJob>>);

export const getJobById = (id: string) =>
  api.get(`/admin/jobs/${id}`).then(data<AdminJob>);

export const getJobFull = (id: string) =>
  api.get(`/admin/jobs/${id}`).then(data<AdminJobDetail>);

export const getJobContentQueue = () =>
  api.get('/admin/jobs/content-queue').then(data<ContentQueueItem[]>);

export const forceCloseJob = (id: string, note?: string) =>
  api.put(`/admin/jobs/${id}/force-close`, { note });

export const removeJob = (id: string, reason: string) =>
  api.post(`/admin/jobs/${id}/remove`, { reason });

export const toggleFeatureJob = (id: string) =>
  api.post(`/admin/jobs/${id}/feature`);

export const changeJobStatus = (id: string, newStatus: string, reason: string) =>
  api.post(`/admin/jobs/${id}/change-status`, { newStatus, reason });

export const flagJob = (id: string, reason: string) =>
  api.post(`/admin/jobs/${id}/flag`, { reason });

// ── Disputes ──────────────────────────────────────────────────────────────────

export const getAdminDisputes = (params: Record<string, unknown>) =>
  api.get('/admin/disputes', { params }).then(data<PageResponse<AdminDispute>>);

export const getAdminDisputeById = (id: string) =>
  api.get(`/admin/disputes/${id}`).then(data<AdminDisputeDetail>);

export const recordRuling = (id: string, ruling: string, note?: string) =>
  api.post(`/admin/disputes/${id}/ruling`, { ruling, note });

export const updateDisputeStatus = (id: string, status: string, note?: string) =>
  api.put(`/admin/disputes/${id}/status`, { status, note });

// ── Audit Log ─────────────────────────────────────────────────────────────────

export const getAuditLog = (params: Record<string, unknown>) =>
  api.get('/admin/audit', { params }).then(data<PageResponse<AuditLogEntry>>);

// ── Platform Settings ─────────────────────────────────────────────────────────

export const getSettings    = () =>
  api.get('/admin/settings').then(data<PlatformSetting[]>);

export const updateSetting  = (key: string, value: unknown) =>
  api.put(`/admin/settings/${encodeURIComponent(key)}`, { value }).then(data<PlatformSetting>);

// ── Feature Flags ─────────────────────────────────────────────────────────────

export const getFeatureFlags   = () =>
  api.get('/admin/flags').then(data<FeatureFlag[]>);

export const updateFeatureFlag = (key: string, enabled: boolean, rolloutPct?: number) =>
  api.put(`/admin/flags/${encodeURIComponent(key)}`, { enabled, rolloutPct }).then(data<FeatureFlag>);

// ── Banned Emails ─────────────────────────────────────────────────────────────

export const getBannedEmails = (params: Record<string, unknown>) =>
  api.get('/admin/banned-emails', { params }).then(data<PageResponse<BannedEmail>>);

export const banEmail   = (email: string, reason?: string) =>
  api.post('/admin/banned-emails', { email, reason });

export const unbanEmail = (email: string) =>
  api.delete(`/admin/banned-emails/${encodeURIComponent(email)}`);
