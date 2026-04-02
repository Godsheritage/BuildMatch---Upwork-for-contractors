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

// v2 dispute schema (disputes table in Supabase)
export interface AdminDispute {
  id: string; jobId: string; jobTitle: string;
  filedById: string; filedByName: string;
  otherPartyId: string | null; otherPartyName: string;
  milestoneDraw: number; amountDisputed: number;
  status: string; daysOpen: number; noteCount: number;
  createdAt: string; updatedAt: string;
}

interface DisputeParty {
  id: string; firstName: string; lastName: string;
  email: string; avatarUrl: string | null; joinedAt: string;
  profile: {
    id: string; specialties: string[]; averageRating: number; completedJobs: number;
    yearsExperience?: number; isLicenseVerified?: boolean; reliabilityScore?: number;
  } | null;
}

interface DisputeMessage {
  id: string; senderId: string; senderName: string;
  content: string; isFiltered: boolean; createdAt: string;
}

interface DisputeNote {
  id: string; adminId: string; adminName: string;
  content: string; createdAt: string;
}

interface DisputeMilestone {
  id: string; order: number; title: string; description: string | null;
  amount: number; percentage: number; status: string;
  completionNotes: string | null; disputeReason: string | null;
  approvedAt: string | null; releasedAt: string | null;
}

interface DisputeEscrow {
  id: string; totalAmount: number; platformFee: number;
  status: string; stripePaymentId: string;
  milestones: { id: string; order: number; title: string; amount: number; percentage: number; status: string }[];
}

export interface AdminDisputeDetail {
  dispute: {
    id: string; jobId: string; filedById: string; milestoneDraw: number;
    amountDisputed: number; reason: string; status: string;
    ruling: string | null; rulingNote: string | null;
    rulingBy: string | null; rulingAt: string | null;
    daysOpen: number; createdAt: string; updatedAt: string;
  };
  job: {
    id: string; title: string; description: string; tradeType: string;
    budgetMin: number; budgetMax: number; city: string; state: string;
    status: string; photos: string[]; createdAt: string;
  } | null;
  investor:   DisputeParty | null;
  contractor: DisputeParty | null;
  messages:   DisputeMessage[];
  milestone:  DisputeMilestone | null;
  notes:      DisputeNote[];
  escrow:     DisputeEscrow | null;
}

export interface AuditLogEntry {
  id: string; adminId: string; adminName: string | null; action: string;
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

export const submitDisputeRuling = (
  id: string,
  payload: { ruling: string; rulingNote: string; splitPct?: number },
) => api.post(`/admin/disputes/${id}/ruling`, payload);

export const addDisputeNote = (id: string, content: string) =>
  api.post(`/admin/disputes/${id}/note`, { content });

export const requestDisputeInfo = (
  id: string,
  targetUserId: string,
  message: string,
) => api.post(`/admin/disputes/${id}/request-info`, { targetUserId, message });

export const updateDisputeStatus = (id: string, status: string, note?: string) =>
  api.put(`/admin/disputes/${id}/status`, { status, note });

// ── Moderation ────────────────────────────────────────────────────────────────

export interface FilteredMessage {
  id: string; conversationId: string; jobId: string; jobTitle: string;
  sender:    { id: string; name: string; email: string; role: string };
  recipient: { id: string; name: string; email: string; role: string } | null;
  filteredContent: string;
  filterReason: string | null;
  createdAt: string;
  senderFilterCount: number;
}

export interface ModerationContentQueueItem {
  type: 'job' | 'review';
  id: string;
  contentPreview: string;
  reason: string | null;
  reporter: { id: string; name: string; email: string } | null;
  createdAt: string;
}

export interface ModerationFlaggedUser {
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; isBanned: boolean; avatarUrl: string | null;
  flaggedForReview: boolean;
  filterCount: number; warningCount: number; disputeLossCount: number;
  severityScore: number; createdAt: string;
}

export const getFilteredMessages = (params: Record<string, unknown>) =>
  api.get('/admin/moderation/filtered-messages', { params }).then(data<PageResponse<FilteredMessage>>);

export const getModerationContentQueue = () =>
  api.get('/admin/moderation/content-queue').then(data<{ queue: ModerationContentQueueItem[]; total: number }>);

export const getModerationFlaggedUsers = () =>
  api.get('/admin/moderation/flagged-users').then(data<{ users: ModerationFlaggedUser[] }>);

export const warnMessageUser = (messageId: string) =>
  api.post(`/admin/moderation/messages/${messageId}/warn-user`);

export const escalateMessageUser = (messageId: string) =>
  api.post(`/admin/moderation/messages/${messageId}/escalate`).then(
    data<{ escalated: boolean; totalFlags: number; suggestedAction: string | null }>
  );

export const warnUserDirectly = (userId: string, reason: string) =>
  api.post(`/admin/moderation/users/${userId}/warn`, { reason });

export const approveModerationContent = (type: string, id: string) =>
  api.post(`/admin/moderation/content/${type}/${id}/approve`);

export const removeModerationContent = (type: string, id: string, reason: string) =>
  api.post(`/admin/moderation/content/${type}/${id}/remove`, { reason });

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

// ── Finance ───────────────────────────────────────────────────────────────────

export type TransactionType = 'escrow_deposit' | 'milestone_release' | 'fee' | 'refund' | 'payout';

export interface FinanceSummary {
  totalGmvAllTime:         number;
  totalGmvThisMonth:       number;
  totalGmvLastMonth:       number;
  totalRevenueAllTime:     number;
  totalRevenueThisMonth:   number;
  totalRevenueLastMonth:   number;
  fundsCurrentlyInEscrow:  number;
  avgJobValue:             number;
  totalTransactions:       number;
  failedTransactions:      number;
  pendingPayouts:          number;
  failedPayouts:           number;
}

export interface FinanceTransaction {
  id:             string;
  jobId:          string;
  jobTitle:       string;
  investorName:   string;
  contractorName: string;
  type:           TransactionType;
  amount:         number;
  platformFee:    number;
  netAmount:      number;
  status:         string;
  stripeId:       string | null;
  createdAt:      string;
}

export interface FinanceTransactionPage {
  data:       FinanceTransaction[];
  total:      number;
  page:       number;
  totalPages: number;
  limit:      number;
}

export interface FinancePayout {
  id:              string;
  contractorId:    string;
  contractorName:  string;
  jobId:           string;
  jobTitle:        string;
  amount:          number;
  stripePayoutId:  string | null;
  status:          string;
  createdAt:       string;
}

export interface FailedItem {
  id:          string;
  type:        'failed_deposit' | 'failed_payout';
  jobId:       string | null;
  jobTitle:    string | null;
  partyName:   string;
  amount:      number;
  stripeId:    string | null;
  status:      string;
  createdAt:   string;
}

export const getFinanceSummary = () =>
  api.get('/admin/finance/summary').then(data<FinanceSummary>);

export const getFinanceTransactions = (params: Record<string, unknown>) =>
  api.get('/admin/finance/transactions', { params }).then(data<FinanceTransactionPage>);

export const getFinancePayouts = (params: Record<string, unknown>) =>
  api.get('/admin/finance/payouts', { params }).then(data<{ payouts: FinancePayout[] }>);

export const retryPayout = (payoutId: string) =>
  api.post(`/admin/finance/payouts/${payoutId}/retry`).then(data<{ stripeTransferId: string }>);

export const getFailedTransactions = () =>
  api.get('/admin/finance/failed-transactions').then(data<{ items: FailedItem[] }>);

export const issueRefund = (jobId: string, amount: number, reason: string) =>
  api.post('/admin/finance/refund', { jobId, amount, reason }).then(data<{ stripeRefundId: string }>);

// ── Reviews ───────────────────────────────────────────────────────────────────

export interface AdminReviewListItem {
  id:                  string;
  title:               string;
  contentPreview:      string;
  body:                string;
  rating:              number;
  reviewerRole:        string;
  reviewerId:          string;
  reviewerName:        string;
  reviewerEmail:       string;
  contractorName:      string;
  contractorProfileId: string | null;
  jobId:               string;
  isFlagged:           boolean;
  isDeleted:           boolean;
  createdAt:           string;
}

export interface ReviewAnomalies {
  ratingDrops:          { type: 'rating_drop'; contractorId: string; contractorProfileId: string; name: string; oldAvg: number; currentAvg: number; drop: number }[];
  potentialFakeSeeding: { type: 'potential_fake_seeding'; contractorId: string; contractorProfileId: string; name: string; averageRating: number; totalReviews: number }[];
  duplicateContent:     { type: 'duplicate_content'; reviewerId: string; name: string; email: string; body: string; contractorCount: number }[];
}

export const getAdminReviews = (params: Record<string, unknown>) =>
  api.get('/admin/reviews', { params }).then(data<PageResponse<AdminReviewListItem>>);

export const getAdminReviewAnomalies = () =>
  api.get('/admin/reviews/anomalies').then(data<ReviewAnomalies>);

export const approveReview  = (id: string) => api.post(`/admin/reviews/${id}/approve`);
export const removeReview   = (id: string, reason: string) => api.post(`/admin/reviews/${id}/remove`, { reason });
export const editReview     = (id: string, newContent: string) => api.post(`/admin/reviews/${id}/edit`, { newContent });
export const flagReview     = (id: string) => api.post(`/admin/reviews/${id}/flag`);

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface UserGrowthData {
  labels:      string[];
  investors:   number[];
  contractors: number[];
  total:       number[];
}

export interface JobFunnelData {
  posted:                 number;
  received_bids:          number;
  awarded:                number;
  in_progress:            number;
  completed:              number;
  completion_rate:        number;
  avg_bids_per_job:       number;
  avg_time_to_award_days: number;
}

export interface RevenueData {
  labels:         string[];
  gmv:            number[];
  revenue:        number[];
  jobs_completed: number[];
}

export interface GeographicEntry {
  state:            string;
  investor_count:   number;
  contractor_count: number;
  job_count:        number;
  gmv:              number;
}

export interface GeographicGap {
  state:            string;
  investor_count:   number;
  contractor_count: number;
  job_count:        number;
  gap_score:        number;
}

export interface GeographicData {
  states: GeographicEntry[];
  gaps:   GeographicGap[];
}

export interface RetentionData {
  investor_repeat_rate:      number;
  contractor_active_90d:     number;
  avg_jobs_per_investor:     number;
  avg_bids_per_contractor:   number;
}

export interface SearchGapQuery {
  query:        string;
  count:        number;
  last_searched: string;
}

export interface SearchGapsData {
  queries:                    SearchGapQuery[];
  period:                     string;
  total_zero_result_searches: number;
}

export const getUserGrowth      = (params: Record<string, unknown>) =>
  api.get('/admin/analytics/user-growth', { params }).then(data<UserGrowthData>);

export const getJobFunnel       = () =>
  api.get('/admin/analytics/job-funnel').then(data<JobFunnelData>);

export const getRevenueOverTime = (params: Record<string, unknown>) =>
  api.get('/admin/analytics/revenue-over-time', { params }).then(data<RevenueData>);

export const getGeographic      = () =>
  api.get('/admin/analytics/geographic').then(data<GeographicData>);

export const getRetention       = () =>
  api.get('/admin/analytics/retention').then(data<RetentionData>);

export const getSearchGaps      = () =>
  api.get('/admin/analytics/search-gaps').then(data<SearchGapsData>);

// ── Health ────────────────────────────────────────────────────────────────────

export type ServiceHealthStatus = 'healthy' | 'degraded' | 'down';

export interface HourlyPerf {
  hour:  string;
  avgMs: number;
  p95Ms: number;
  count: number;
}

export interface HealthStatusData {
  api: {
    status:             ServiceHealthStatus;
    avgResponseMs:      number;
    p95ResponseMs:      number;
    hourlyPerformance:  HourlyPerf[];
  };
  database: {
    status:             ServiceHealthStatus;
    queryAvgMs:         number;
    connectionPoolUsed: number;
  };
  storage: {
    status:             ServiceHealthStatus;
    avatarsBucketMb:    number;
    jobPhotosBucketMb:  number;
    jobVideosBucketMb:  number;
  };
  stripe: {
    status:                ServiceHealthStatus;
    lastWebhookReceivedAt: string | null;
  };
  supabaseRealtime: {
    status:            ServiceHealthStatus;
    activeConnections: number;
  };
}

export interface ApiErrorEntry {
  id:          string;
  endpoint:    string;
  method:      string;
  status_code: number;
  error_msg:   string | null;
  user_id:     string | null;
  created_at:  string;
}

export interface BackgroundJobRun {
  id:          string;
  job_name:    string;
  status:      string;
  error_msg:   string | null;
  duration_ms: number | null;
  created_at:  string;
}

export interface BackgroundJobSummary {
  job_name:    string;
  last_run_at: string | null;
  status:      string;
  error_msg:   string | null;
  run_count:   number;
  fail_count:  number;
}

export interface BackgroundJobsData {
  jobs:    BackgroundJobSummary[];
  since:   string;
  rawRuns: BackgroundJobRun[];
}

export const getHealthStatus    = () =>
  api.get('/admin/health/status').then(data<HealthStatusData>);

export const getHealthErrors    = (params: Record<string, unknown>) =>
  api.get('/admin/health/errors', { params }).then(data<PageResponse<ApiErrorEntry>>);

export const getBackgroundJobs  = () =>
  api.get('/admin/health/background-jobs').then(data<BackgroundJobsData>);

export const triggerBackgroundJob = (jobName: string) =>
  api.post(`/admin/health/jobs/${encodeURIComponent(jobName)}/trigger`)
     .then(data<{ triggered: boolean; jobName: string; runId: string }>);

// ── Settings v2 (combined settings + flags) ───────────────────────────────────

export interface FilterPattern {
  id:          string;
  pattern:     string;
  type:        string;
  description: string;
  addedAt:     string;
}

export interface SettingsAndFlags {
  settings: PlatformSetting[];
  flags:    FeatureFlag[];
}

export const getAdminSettingsAll = () =>
  api.get('/admin/settings').then(data<SettingsAndFlags>);

export const updateSettingWithNote = (key: string, value: unknown, note?: string) =>
  api.put(`/admin/settings/${encodeURIComponent(key)}`, { value, note })
     .then(data<PlatformSetting>);

export const updateFeatureFlagViaSettings = (key: string, enabled: boolean, rolloutPct?: number) =>
  api.put(`/admin/settings/flags/${encodeURIComponent(key)}`, { enabled, rolloutPct })
     .then(data<FeatureFlag>);

export const getFilterPatterns = () =>
  api.get('/admin/settings/filter-patterns').then(data<{ patterns: FilterPattern[] }>);

export const addFilterPattern = (pattern: string, type: string, description: string) =>
  api.post('/admin/settings/filter-patterns', { pattern, type, description })
     .then(data<{ pattern: FilterPattern }>);

export const deleteFilterPattern = (patternId: string) =>
  api.delete(`/admin/settings/filter-patterns/${encodeURIComponent(patternId)}`);

// ── Testimonials ──────────────────────────────────────────────────────────────

export interface AdminTestimonial {
  id:                  string;
  authorName:          string;
  authorEmail:         string;
  body:                string;
  approved:            boolean;
  approvedAt:          string | null;
  createdAt:           string;
  contractorProfileId: string;
  contractorName:      string;
  contractorUserId:    string;
  contractorEmail:     string;
}

export const getAdminTestimonials = (params: Record<string, unknown>) =>
  api.get('/admin/testimonials', { params }).then(data<PageResponse<AdminTestimonial>>);

export const getTestimonialPendingCount = () =>
  api.get('/admin/testimonials/pending-count').then(data<{ count: number }>);

export const approveTestimonial = (id: string) =>
  api.post(`/admin/testimonials/${id}/approve`);

export const rejectTestimonial = (id: string, reason: string) =>
  api.post(`/admin/testimonials/${id}/reject`, { reason });

// ── Audit log export ──────────────────────────────────────────────────────────

export async function exportAuditLog(params: Record<string, unknown>): Promise<void> {
  const res = await api.get('/admin/audit/export', {
    params:       { ...params, format: 'csv' },
    responseType: 'blob',
  });
  const blob      = new Blob([res.data as BlobPart], { type: 'text/csv' });
  const url       = URL.createObjectURL(blob);
  const a         = document.createElement('a');
  a.href          = url;
  a.download      = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
