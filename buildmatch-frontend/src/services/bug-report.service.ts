import api from './api';
import { getSupabaseClient } from '../lib/supabase';

export type BugSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SubmitBugReportPayload {
  title:          string;
  description:    string;
  severity:       BugSeverity;
  pageUrl?:       string;
  userAgent?:     string;
  screenshotUrls: string[];
}

interface ApiResp<T> { success: boolean; data: T; message?: string }

export async function submitBugReport(payload: SubmitBugReportPayload): Promise<{ id: string }> {
  const { data } = await api.post<ApiResp<{ id: string }>>('/bug-reports', payload);
  return data.data;
}

// ── Screenshot upload ───────────────────────────────────────────────────────
// Uses authenticated /upload/presign for logged-in users, otherwise the
// public bug-reports presign endpoint. Returns the public URL.

export async function uploadScreenshot(file: File, isLoggedIn: boolean, userId?: string): Promise<string> {
  const ext  = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${userId ?? 'anon'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  let presign: { signedUrl: string; token: string; path: string; bucket: string };
  if (isLoggedIn && userId) {
    const { data } = await api.post<ApiResp<{ signedUrl: string; token: string; path: string }>>(
      '/upload/presign',
      { bucket: 'bug-reports', path },
    );
    presign = { ...data.data, bucket: 'bug-reports' };
  } else {
    const { data } = await api.post<ApiResp<{ signedUrl: string; token: string; path: string; bucket: string }>>(
      '/upload/presign-public',
      { filename: `${ext}.${ext}` },
    );
    presign = data.data;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage
    .from(presign.bucket)
    .uploadToSignedUrl(presign.path, presign.token, file, { contentType: file.type });
  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage.from(presign.bucket).getPublicUrl(presign.path);
  return urlData.publicUrl;
}
