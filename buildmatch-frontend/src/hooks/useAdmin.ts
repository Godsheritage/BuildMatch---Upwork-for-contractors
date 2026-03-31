import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as adminService from '../services/admin.service';
import { useToast } from '../context/ToastContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function qk(...parts: unknown[]) {
  return ['admin', ...parts];
}

// ── Overview ──────────────────────────────────────────────────────────────────

export function useOverviewStats() {
  return useQuery({
    queryKey:        qk('overview', 'stats'),
    queryFn:         adminService.getOverviewStats,
    staleTime:       60_000,
    refetchInterval: 60_000,
  });
}

export function useOverviewActivity() {
  return useQuery({
    queryKey:        qk('overview', 'activity'),
    queryFn:         adminService.getOverviewActivity,
    staleTime:       30_000,
    refetchInterval: 30_000,
  });
}

export function useOverviewAlerts() {
  return useQuery({
    queryKey:        qk('overview', 'alerts'),
    queryFn:         adminService.getOverviewAlerts,
    staleTime:       30_000,
    refetchInterval: 30_000,
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function useAdminStats() {
  return useQuery({
    queryKey:  qk('stats'),
    queryFn:   adminService.getStats,
    staleTime: 60_000,
  });
}

export function useAdminActivity() {
  return useQuery({
    queryKey:  qk('activity'),
    queryFn:   adminService.getActivity,
    staleTime: 30_000,
  });
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function useAdminUsers(params: Record<string, unknown>) {
  return useQuery({
    queryKey:  qk('users', params),
    queryFn:   () => adminService.getUsers(params),
    staleTime: 30_000,
  });
}

export function useAdminUser(id: string | null) {
  return useQuery({
    queryKey:  qk('users', id),
    queryFn:   () => adminService.getUserById(id!),
    enabled:   !!id,
    staleTime: 30_000,
  });
}

export function useAdminUserFull(id: string | null) {
  return useQuery({
    queryKey:  qk('users', 'full', id),
    queryFn:   () => adminService.getUserFullProfile(id!),
    enabled:   !!id,
    staleTime: 30_000,
  });
}

export function useAdminFlaggedUsers() {
  return useQuery({
    queryKey:  qk('users', 'flagged'),
    queryFn:   adminService.getFlaggedUsers,
    staleTime: 60_000,
  });
}

export function useSuspendUser() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, reason, durationDays }: { id: string; reason: string; durationDays?: number | null }) =>
      adminService.suspendUser(id, reason, durationDays),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk('users') }); toast('User suspended', 'success'); },
    onError:   () => toast('Failed to suspend user', 'error'),
  });
}

export function useUnsuspendUser() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => adminService.unsuspendUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk('users') }); toast('User unsuspended', 'success'); },
    onError:   () => toast('Failed to unsuspend user', 'error'),
  });
}

export function useBanUserPost() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminService.banUserPost(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk('users') }); toast('User banned', 'success'); },
    onError:   () => toast('Failed to ban user', 'error'),
  });
}

export function useVerifyContractorUser() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => adminService.verifyContractorUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk('users') }); toast('Contractor verified', 'success'); },
    onError:   () => toast('Failed to verify contractor', 'error'),
  });
}

export function useImpersonateUser() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => adminService.impersonateUser(id),
    onError:    () => toast('Failed to impersonate user', 'error'),
  });
}

export function useSendAdminMessage() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, subject, content }: { id: string; subject: string; content: string }) =>
      adminService.sendAdminMessage(id, subject, content),
    onSuccess: () => toast('Message sent', 'success'),
    onError:   () => toast('Failed to send message', 'error'),
  });
}

export function useBanUser() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => adminService.banUser(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('users') }); toast('User banned', 'success'); },
    onError:    () => toast('Failed to ban user', 'error'),
  });
}

export function useUnbanUser() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => adminService.unbanUser(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('users') }); toast('User unbanned', 'success'); },
    onError:    () => toast('Failed to unban user', 'error'),
  });
}

export function useChangeUserRole() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, role, note }: { id: string; role: string; note?: string }) =>
      adminService.changeUserRole(id, role, note),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk('users') }); toast('Role updated', 'success'); },
    onError:   () => toast('Failed to change role', 'error'),
  });
}

// ── Contractors ───────────────────────────────────────────────────────────────

export function useAdminContractors(params: Record<string, unknown>) {
  return useQuery({
    queryKey:  qk('contractors', params),
    queryFn:   () => adminService.getContractors(params),
    staleTime: 30_000,
  });
}

export function useVerifyLicense() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (profileId: string) => adminService.verifyLicense(profileId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('contractors') }); toast('License verified', 'success'); },
    onError:    () => toast('Failed to verify license', 'error'),
  });
}

export function useUnverifyLicense() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (profileId: string) => adminService.unverifyLicense(profileId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('contractors') }); toast('License unverified', 'success'); },
    onError:    () => toast('Failed to unverify license', 'error'),
  });
}

export function useSetAvailability() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ profileId, isAvailable }: { profileId: string; isAvailable: boolean }) =>
      adminService.setAvailability(profileId, isAvailable),
    onSuccess: (_, { isAvailable }) => {
      qc.invalidateQueries({ queryKey: qk('contractors') });
      toast(`Availability set to ${isAvailable ? 'available' : 'unavailable'}`, 'success');
    },
    onError: () => toast('Failed to update availability', 'error'),
  });
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export function useAdminJobs(params: Record<string, unknown>) {
  return useQuery({
    queryKey:  qk('jobs', params),
    queryFn:   () => adminService.getJobs(params),
    staleTime: 30_000,
  });
}

export function useAdminJob(id: string | null) {
  return useQuery({
    queryKey:  qk('jobs', id),
    queryFn:   () => adminService.getJobById(id!),
    enabled:   !!id,
    staleTime: 30_000,
  });
}

export function useAdminJobFull(id: string | null) {
  return useQuery({
    queryKey:  qk('jobs', 'full', id),
    queryFn:   () => adminService.getJobFull(id!),
    enabled:   !!id,
    staleTime: 30_000,
  });
}

export function useAdminJobsContentQueue() {
  return useQuery({
    queryKey:  qk('jobs', 'content-queue'),
    queryFn:   adminService.getJobContentQueue,
    staleTime: 30_000,
  });
}

export function useForceCloseJob() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      adminService.forceCloseJob(id, note),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('jobs') }); toast('Job force-closed', 'success'); },
    onError:    () => toast('Failed to close job', 'error'),
  });
}

export function useRemoveJob() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminService.removeJob(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk('jobs') }); toast('Job removed', 'success'); },
    onError:   () => toast('Failed to remove job', 'error'),
  });
}

export function useToggleFeatureJob() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => adminService.toggleFeatureJob(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk('jobs') }); toast('Feature updated', 'success'); },
    onError:   () => toast('Failed to update feature', 'error'),
  });
}

export function useChangeJobStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, newStatus, reason }: { id: string; newStatus: string; reason: string }) =>
      adminService.changeJobStatus(id, newStatus, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk('jobs') }); toast('Status updated', 'success'); },
    onError:   () => toast('Failed to change status', 'error'),
  });
}

export function useFlagJob() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminService.flagJob(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk('jobs') }); toast('Job flagged', 'success'); },
    onError:   () => toast('Failed to flag job', 'error'),
  });
}

// ── Disputes ──────────────────────────────────────────────────────────────────

export function useAdminDisputes(params: Record<string, unknown>) {
  return useQuery({
    queryKey:  qk('disputes', params),
    queryFn:   () => adminService.getAdminDisputes(params),
    staleTime: 30_000,
  });
}

export function useAdminDispute(id: string | null) {
  return useQuery({
    queryKey:  qk('disputes', id),
    queryFn:   () => adminService.getAdminDisputeById(id!),
    enabled:   !!id,
    staleTime: 30_000,
  });
}

export function useSubmitDisputeRuling() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, ruling, rulingNote, splitPct }: {
      id: string; ruling: string; rulingNote: string; splitPct?: number;
    }) => adminService.submitDisputeRuling(id, { ruling, rulingNote, splitPct }),
    onSuccess:  (_d, { id }) => {
      qc.invalidateQueries({ queryKey: qk('disputes') });
      qc.invalidateQueries({ queryKey: qk('disputes', id) });
      toast('Ruling recorded', 'success');
    },
    onError:    () => toast('Failed to record ruling', 'error'),
  });
}

export function useAddDisputeNote() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      adminService.addDisputeNote(id, content),
    onSuccess:  (_d, { id }) => {
      qc.invalidateQueries({ queryKey: qk('disputes', id) });
    },
    onError:    () => toast('Failed to add note', 'error'),
  });
}

export function useRequestDisputeInfo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, targetUserId, message }: {
      id: string; targetUserId: string; message: string;
    }) => adminService.requestDisputeInfo(id, targetUserId, message),
    onSuccess:  (_d, { id }) => {
      qc.invalidateQueries({ queryKey: qk('disputes') });
      qc.invalidateQueries({ queryKey: qk('disputes', id) });
      toast('Request sent', 'success');
    },
    onError:    () => toast('Failed to send request', 'error'),
  });
}

export function useUpdateDisputeStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      adminService.updateDisputeStatus(id, status, note),
    onSuccess:  (_d, { id }) => {
      qc.invalidateQueries({ queryKey: qk('disputes') });
      qc.invalidateQueries({ queryKey: qk('disputes', id) });
      toast('Status updated', 'success');
    },
    onError:    () => toast('Failed to update status', 'error'),
  });
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export function useAdminAuditLog(params: Record<string, unknown>) {
  return useQuery({
    queryKey:  qk('audit', params),
    queryFn:   () => adminService.getAuditLog(params),
    staleTime: 30_000,
  });
}

// ── Platform Settings ─────────────────────────────────────────────────────────

export function useAdminSettings() {
  return useQuery({
    queryKey:  qk('settings'),
    queryFn:   adminService.getSettings,
    staleTime: 60_000,
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      adminService.updateSetting(key, value),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('settings') }); toast('Setting updated', 'success'); },
    onError:    () => toast('Failed to update setting', 'error'),
  });
}

// ── Feature Flags ─────────────────────────────────────────────────────────────

export function useAdminFeatureFlags() {
  return useQuery({
    queryKey:  qk('flags'),
    queryFn:   adminService.getFeatureFlags,
    staleTime: 60_000,
  });
}

export function useUpdateFeatureFlag() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ key, enabled, rolloutPct }: { key: string; enabled: boolean; rolloutPct?: number }) =>
      adminService.updateFeatureFlag(key, enabled, rolloutPct),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('flags') }); toast('Flag updated', 'success'); },
    onError:    () => toast('Failed to update flag', 'error'),
  });
}

// ── Banned Emails ─────────────────────────────────────────────────────────────

export function useAdminBannedEmails(params: Record<string, unknown>) {
  return useQuery({
    queryKey:  qk('banned-emails', params),
    queryFn:   () => adminService.getBannedEmails(params),
    staleTime: 30_000,
  });
}

export function useBanEmail() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ email, reason }: { email: string; reason?: string }) =>
      adminService.banEmail(email, reason),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('banned-emails') }); toast('Email banned', 'success'); },
    onError:    () => toast('Failed to ban email', 'error'),
  });
}

export function useUnbanEmail() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (email: string) => adminService.unbanEmail(email),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('banned-emails') }); toast('Email unbanned', 'success'); },
    onError:    () => toast('Failed to unban email', 'error'),
  });
}

// ── Finance ───────────────────────────────────────────────────────────────────

export function useFinanceSummary() {
  return useQuery({
    queryKey:  qk('finance', 'summary'),
    queryFn:   adminService.getFinanceSummary,
    staleTime: 60_000,
  });
}

export function useFinanceTransactions(params: Record<string, unknown>) {
  return useQuery({
    queryKey:  qk('finance', 'transactions', params),
    queryFn:   () => adminService.getFinanceTransactions(params),
    staleTime: 30_000,
  });
}

export function useFinancePayouts(params: Record<string, unknown>) {
  return useQuery({
    queryKey:  qk('finance', 'payouts', params),
    queryFn:   () => adminService.getFinancePayouts(params),
    staleTime: 30_000,
  });
}

export function useFailedTransactions() {
  return useQuery({
    queryKey:  qk('finance', 'failed'),
    queryFn:   adminService.getFailedTransactions,
    staleTime: 30_000,
  });
}

export function useRetryPayout() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (payoutId: string) => adminService.retryPayout(payoutId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk('finance') });
      toast('Payout retry initiated', 'success');
    },
    onError: () => toast('Failed to retry payout', 'error'),
  });
}

export function useIssueRefund() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ jobId, amount, reason }: { jobId: string; amount: number; reason: string }) =>
      adminService.issueRefund(jobId, amount, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk('finance') });
      toast('Refund issued successfully', 'success');
    },
    onError: () => toast('Failed to issue refund', 'error'),
  });
}

// ── Moderation ─────────────────────────────────────────────────────────────────

export function useFilteredMessages(params: Record<string, unknown>) {
  return useQuery({
    queryKey:  qk('moderation', 'filtered-messages', params),
    queryFn:   () => adminService.getFilteredMessages(params),
    staleTime: 30_000,
  });
}

export function useModerationContentQueue() {
  return useQuery({
    queryKey:  qk('moderation', 'content-queue'),
    queryFn:   adminService.getModerationContentQueue,
    staleTime: 30_000,
  });
}

export function useModerationFlaggedUsers() {
  return useQuery({
    queryKey:  qk('moderation', 'flagged-users'),
    queryFn:   adminService.getModerationFlaggedUsers,
    staleTime: 30_000,
  });
}

export function useWarnMessageUser() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (messageId: string) => adminService.warnMessageUser(messageId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: qk('moderation', 'filtered-messages') });
      qc.invalidateQueries({ queryKey: qk('moderation', 'flagged-users') });
      toast('Warning sent to user', 'success');
    },
    onError: () => toast('Failed to send warning', 'error'),
  });
}

export function useEscalateMessageUser() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (messageId: string) => adminService.escalateMessageUser(messageId),
    onSuccess:  (res) => {
      qc.invalidateQueries({ queryKey: qk('moderation') });
      const suggestion = (res as { data?: { suggestedAction?: string | null } })?.data?.suggestedAction;
      toast(suggestion === 'SUSPEND' ? 'Escalated — suspension recommended' : 'User escalated', 'success');
    },
    onError: () => toast('Failed to escalate user', 'error'),
  });
}

export function useWarnUserDirectly() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminService.warnUserDirectly(userId, reason),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: qk('moderation', 'flagged-users') });
      toast('Warning sent', 'success');
    },
    onError: () => toast('Failed to send warning', 'error'),
  });
}

export function useApproveModerationContent() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) =>
      adminService.approveModerationContent(type, id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: qk('moderation', 'content-queue') });
      toast('Content approved', 'success');
    },
    onError: () => toast('Failed to approve content', 'error'),
  });
}

// ── Reviews ────────────────────────────────────────────────────────────────────

export function useAdminReviewQueue() {
  return useQuery({
    queryKey:  qk('reviews', 'queue'),
    queryFn:   () => adminService.getAdminReviews({ status: 'pending_moderation', limit: 100, page: 1 }),
    staleTime: 30_000,
  });
}

export function useAdminReviews(params: Record<string, unknown>) {
  return useQuery({
    queryKey:  qk('reviews', params),
    queryFn:   () => adminService.getAdminReviews(params),
    staleTime: 30_000,
  });
}

export function useAdminReviewAnomalies() {
  return useQuery({
    queryKey:  qk('reviews', 'anomalies'),
    queryFn:   adminService.getAdminReviewAnomalies,
    staleTime: 60_000,
  });
}

export function useApproveReview() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => adminService.approveReview(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('reviews') }); toast('Review approved', 'success'); },
    onError:    () => toast('Failed to approve review', 'error'),
  });
}

export function useRemoveReview() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminService.removeReview(id, reason),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('reviews') }); toast('Review removed', 'success'); },
    onError:    () => toast('Failed to remove review', 'error'),
  });
}

export function useEditReview() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, newContent }: { id: string; newContent: string }) => adminService.editReview(id, newContent),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('reviews') }); toast('Review updated', 'success'); },
    onError:    () => toast('Failed to update review', 'error'),
  });
}

export function useFlagReview() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => adminService.flagReview(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('reviews') }); toast('Review flagged', 'success'); },
    onError:    () => toast('Failed to flag review', 'error'),
  });
}

export function useRemoveModerationContent() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ type, id, reason }: { type: string; id: string; reason: string }) =>
      adminService.removeModerationContent(type, id, reason),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: qk('moderation', 'content-queue') });
      toast('Content removed', 'success');
    },
    onError: () => toast('Failed to remove content', 'error'),
  });
}

// ── Health ────────────────────────────────────────────────────────────────────

export function useHealthStatus() {
  return useQuery({
    queryKey:        qk('health', 'status'),
    queryFn:         adminService.getHealthStatus,
    staleTime:       0,           // always re-fetch (live status)
    refetchInterval: 30_000,
  });
}

export function useHealthErrors(params: Record<string, unknown>) {
  return useQuery({
    queryKey:  qk('health', 'errors', params),
    queryFn:   () => adminService.getHealthErrors(params),
    staleTime: 30_000,
  });
}

export function useBackgroundJobs() {
  return useQuery({
    queryKey:        qk('health', 'background-jobs'),
    queryFn:         adminService.getBackgroundJobs,
    staleTime:       0,
    refetchInterval: 30_000,
  });
}

export function useTriggerBackgroundJob() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (jobName: string) => adminService.triggerBackgroundJob(jobName),
    onSuccess:  (_d, jobName) => {
      qc.invalidateQueries({ queryKey: qk('health', 'background-jobs') });
      toast(`${jobName} triggered`, 'success');
    },
    onError: () => toast('Failed to trigger job', 'error'),
  });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

const ANALYTICS_STALE = 6 * 60 * 60 * 1000; // 6 h — mirrors server-side cache TTL

export function useUserGrowth(params: Record<string, unknown>) {
  return useQuery({
    queryKey:  qk('analytics', 'user-growth', params),
    queryFn:   () => adminService.getUserGrowth(params),
    staleTime: ANALYTICS_STALE,
  });
}

export function useJobFunnel() {
  return useQuery({
    queryKey:  qk('analytics', 'job-funnel'),
    queryFn:   adminService.getJobFunnel,
    staleTime: ANALYTICS_STALE,
  });
}

export function useRevenueOverTime(params: Record<string, unknown>) {
  return useQuery({
    queryKey:  qk('analytics', 'revenue-over-time', params),
    queryFn:   () => adminService.getRevenueOverTime(params),
    staleTime: ANALYTICS_STALE,
  });
}

export function useGeographic() {
  return useQuery({
    queryKey:  qk('analytics', 'geographic'),
    queryFn:   adminService.getGeographic,
    staleTime: ANALYTICS_STALE,
  });
}

export function useRetention() {
  return useQuery({
    queryKey:  qk('analytics', 'retention'),
    queryFn:   adminService.getRetention,
    staleTime: ANALYTICS_STALE,
  });
}

export function useSearchGaps() {
  return useQuery({
    queryKey:  qk('analytics', 'search-gaps'),
    queryFn:   adminService.getSearchGaps,
    staleTime: ANALYTICS_STALE,
  });
}

// ── Settings v2 (combined settings + flags) ───────────────────────────────────

export function useAdminSettingsAll() {
  return useQuery({
    queryKey:  qk('settings-all'),
    queryFn:   adminService.getAdminSettingsAll,
    staleTime: 60_000,
  });
}

export function useUpdateSettingWithNote() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ key, value, note }: { key: string; value: unknown; note?: string }) =>
      adminService.updateSettingWithNote(key, value, note),
    onSuccess:  (_d, { key }) => {
      qc.invalidateQueries({ queryKey: qk('settings-all') });
      qc.invalidateQueries({ queryKey: qk('settings') });
      toast(`Setting "${key}" updated`, 'success');
    },
    onError:    () => toast('Failed to update setting', 'error'),
  });
}

export function useUpdateFeatureFlagViaSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ key, enabled, rolloutPct }: { key: string; enabled: boolean; rolloutPct?: number }) =>
      adminService.updateFeatureFlagViaSettings(key, enabled, rolloutPct),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: qk('settings-all') });
      qc.invalidateQueries({ queryKey: qk('flags') });
      toast('Feature flag updated', 'success');
    },
    onError:    () => toast('Failed to update flag', 'error'),
  });
}

export function useFilterPatterns() {
  return useQuery({
    queryKey:  qk('filter-patterns'),
    queryFn:   adminService.getFilterPatterns,
    staleTime: 60_000,
  });
}

export function useAddFilterPattern() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ pattern, type, description }: { pattern: string; type: string; description: string }) =>
      adminService.addFilterPattern(pattern, type, description),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: qk('filter-patterns') });
      toast('Filter pattern added', 'success');
    },
    onError:    () => toast('Failed to add filter pattern', 'error'),
  });
}

export function useDeleteFilterPattern() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (patternId: string) => adminService.deleteFilterPattern(patternId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: qk('filter-patterns') });
      toast('Filter pattern removed', 'success');
    },
    onError:    () => toast('Failed to remove filter pattern', 'error'),
  });
}
