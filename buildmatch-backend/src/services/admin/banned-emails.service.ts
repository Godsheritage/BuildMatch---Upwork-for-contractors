import { getServiceClient } from '../../lib/supabase';
import { AppError } from '../../utils/app-error';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BannedEmail {
  email:    string;
  bannedAt: string;
  bannedBy: string | null;
  reason:   string | null;
}

export interface BannedEmailPage {
  data:       BannedEmail[];
  total:      number;
  page:       number;
  totalPages: number;
  limit:      number;
}

// ── getBannedEmails ───────────────────────────────────────────────────────────

export async function getBannedEmails(params: {
  page:    number;
  limit:   number;
  search?: string;
}): Promise<BannedEmailPage> {
  const { page, limit, search } = params;
  const offset = (page - 1) * limit;
  const supabase = getServiceClient();

  let countQ = supabase.from('banned_emails').select('*', { count: 'exact', head: true });
  let dataQ  = supabase
    .from('banned_emails')
    .select('*')
    .order('banned_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    countQ = countQ.ilike('email', `%${search}%`);
    dataQ  = dataQ.ilike('email', `%${search}%`);
  }

  const [countRes, dataRes] = await Promise.all([countQ, dataQ]);
  const total = countRes.count ?? 0;
  const rows  = (dataRes.data ?? []) as {
    email:     string;
    banned_at: string;
    banned_by: string | null;
    reason:    string | null;
  }[];

  return {
    data: rows.map((r) => ({
      email:    r.email,
      bannedAt: r.banned_at,
      bannedBy: r.banned_by,
      reason:   r.reason,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
  };
}

// ── banEmail ──────────────────────────────────────────────────────────────────

export async function banEmail(
  adminId: string,
  email: string,
  reason?: string,
): Promise<void> {
  const normalised = email.toLowerCase().trim();

  const { data: existing } = await getServiceClient()
    .from('banned_emails')
    .select('email')
    .eq('email', normalised)
    .maybeSingle();

  if (existing) throw new AppError('Email is already banned', 409);

  const { error } = await getServiceClient()
    .from('banned_emails')
    .insert({ email: normalised, banned_by: adminId, reason: reason ?? null });

  if (error) throw new AppError('Failed to ban email', 500);
}

// ── unbanEmail ────────────────────────────────────────────────────────────────

export async function unbanEmail(email: string): Promise<void> {
  const normalised = email.toLowerCase().trim();

  const { error } = await getServiceClient()
    .from('banned_emails')
    .delete()
    .eq('email', normalised);

  if (error) throw new AppError('Failed to unban email', 500);
}

// ── isEmailBanned ─────────────────────────────────────────────────────────────
// Used in auth registration flow to block banned addresses.

export async function isEmailBanned(email: string): Promise<boolean> {
  const { data } = await getServiceClient()
    .from('banned_emails')
    .select('email')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();
  return !!data;
}
