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

export function useRecordRuling() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, ruling, note }: { id: string; ruling: string; note?: string }) =>
      adminService.recordRuling(id, ruling, note),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('disputes') }); toast('Ruling recorded', 'success'); },
    onError:    () => toast('Failed to record ruling', 'error'),
  });
}

export function useUpdateDisputeStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      adminService.updateDisputeStatus(id, status, note),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: qk('disputes') }); toast('Status updated', 'success'); },
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
