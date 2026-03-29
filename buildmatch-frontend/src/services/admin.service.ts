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
  role: string; isActive: boolean; isVerified: boolean; createdAt: string; jobCount: number;
  // detail only:
  phone?: string | null; city?: string | null; state?: string | null;
  company?: string | null; avatarUrl?: string | null;
  contractor?: { id: string; specialties: string[]; averageRating: number; completedJobs: number; isLicenseVerified: boolean; isAvailable: boolean } | null;
  recentJobs?: { id: string; title: string; status: string; createdAt: string }[];
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
  bidCount: number; investorId: string; investorName: string; createdAt: string;
  // detail only:
  description?: string; zipCode?: string;
  bids?: { id: string; contractorId: string; contractorName: string; amount: number; status: string; createdAt: string }[];
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
  id: number; action: string; actorId: string; entityId: string;
  payload: Record<string, unknown>; createdAt: string;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export const getStats      = () => api.get('/admin/stats').then(data<PlatformStats>);
export const getActivity   = () => api.get('/admin/stats/activity').then(data<RecentActivityItem[]>);

// ── Users ─────────────────────────────────────────────────────────────────────

export const getUsers = (params: Record<string, unknown>) =>
  api.get('/admin/users', { params }).then(data<PageResponse<AdminUser>>);

export const getUserById = (id: string) =>
  api.get(`/admin/users/${id}`).then(data<AdminUser>);

export const banUser   = (id: string) => api.put(`/admin/users/${id}/ban`);
export const unbanUser = (id: string) => api.put(`/admin/users/${id}/unban`);

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

export const getJobById   = (id: string) =>
  api.get(`/admin/jobs/${id}`).then(data<AdminJob>);

export const forceCloseJob = (id: string, note?: string) =>
  api.put(`/admin/jobs/${id}/force-close`, { note });

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
