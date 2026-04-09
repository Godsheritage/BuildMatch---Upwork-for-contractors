import api from './api';

interface ApiResp<T> { success: boolean; data: T; message?: string }

export type SessionStatus = 'NONE' | 'PENDING' | 'UPLOADED' | 'EXPIRED';

export interface CreateSessionResult {
  token:     string;
  mobileUrl: string;
  expiresAt: string;
}

export async function createSession(): Promise<CreateSessionResult> {
  const { data } = await api.post<ApiResp<CreateSessionResult>>('/identity/session');
  return data.data;
}

export async function getSessionStatus(): Promise<{ status: SessionStatus; expiresAt: string | null }> {
  const { data } = await api.get<ApiResp<{ status: SessionStatus; expiresAt: string | null }>>(
    '/identity/session/status',
  );
  return data.data;
}

// ── Mobile-side (no JWT — token in URL acts as auth) ────────────────────────

export interface MobileSession {
  sessionId: string;
  user:      { firstName: string; lastName: string; email: string };
  expiresAt: string;
}

export async function getMobileSession(token: string): Promise<MobileSession> {
  const { data } = await api.get<ApiResp<MobileSession>>(`/identity/m/${token}`);
  return data.data;
}

export async function presignMobileUpload(
  token: string,
  kind:  'document' | 'selfie',
  ext:   string,
): Promise<{ signedUrl: string; token: string; path: string; bucket: string }> {
  const { data } = await api.post<ApiResp<{ signedUrl: string; token: string; path: string; bucket: string }>>(
    `/identity/m/${token}/presign`,
    { kind, ext },
  );
  return data.data;
}

export async function completeMobileSession(
  token: string,
  payload: { documentUrl: string; selfieUrl: string; country: string; idType: string },
): Promise<void> {
  await api.post(`/identity/m/${token}/complete`, payload);
}
