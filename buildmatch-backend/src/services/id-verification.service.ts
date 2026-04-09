import crypto from 'crypto';
import prisma from '../lib/prisma';
import { getServiceClient } from '../lib/supabase';
import { AppError } from '../utils/app-error';

// Mobile handoff: desktop creates a session → user scans QR on phone →
// phone walks the capture flow using the session token (not a JWT) → submits.

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const BUCKET = 'dispute-evidence';     // reuse existing bucket (RLS already set)

function makeToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function frontendBaseUrl(): string {
  const raw = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  return raw.split(',')[0]!.trim().replace(/\/$/, '');
}

// Mobile-only UA detection. Excludes tablets (iPad, Android tablets) per spec.
export function isMobilePhoneUA(ua: string | undefined): boolean {
  if (!ua) return false;
  if (/iPad/i.test(ua)) return false;
  // Modern iPadOS reports as Mac — but it has touch points; we can't fully
  // detect from UA alone, so accept the UA-level filter and let client-side
  // double-check via window.matchMedia('(pointer: coarse)') + screen size.
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return false; // Android tablet
  return /iPhone|Android.*Mobile|iPod/i.test(ua);
}

// ── Session create (called from desktop, authenticated) ─────────────────────

export async function createSession(userId: string): Promise<{
  token:     string;
  expiresAt: Date;
  mobileUrl: string;
}> {
  // One active session per user.
  await prisma.idVerificationSession.deleteMany({
    where: { userId, status: 'PENDING' },
  });

  const raw       = makeToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.idVerificationSession.create({
    data: { userId, tokenHash, expiresAt },
  });

  const mobileUrl = `${frontendBaseUrl()}/verify-id/m/${raw}`;
  return { token: raw, expiresAt, mobileUrl };
}

// ── Status (called from desktop polling, authenticated) ─────────────────────

export async function getSessionStatus(userId: string): Promise<{
  status:    'NONE' | 'PENDING' | 'UPLOADED' | 'EXPIRED';
  expiresAt: Date | null;
}> {
  const session = await prisma.idVerificationSession.findFirst({
    where:   { userId },
    orderBy: { createdAt: 'desc' },
  });
  if (!session) return { status: 'NONE', expiresAt: null };
  if (session.status === 'UPLOADED') return { status: 'UPLOADED', expiresAt: session.expiresAt };
  if (session.expiresAt < new Date()) return { status: 'EXPIRED', expiresAt: session.expiresAt };
  return { status: 'PENDING', expiresAt: session.expiresAt };
}

// ── Resolve a raw mobile token → live session (mobile flow) ─────────────────

async function resolveSession(rawToken: string) {
  if (!rawToken) throw new AppError('Invalid or expired link', 400);
  const tokenHash = hashToken(rawToken);
  const session = await prisma.idVerificationSession.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!session) throw new AppError('Invalid or expired link', 400);
  if (session.status === 'UPLOADED') throw new AppError('This session has already been used', 400);
  if (session.expiresAt < new Date()) throw new AppError('This link has expired', 400);
  return session;
}

export async function getMobileSession(rawToken: string) {
  const s = await resolveSession(rawToken);
  return {
    sessionId: s.id,
    user: {
      firstName: s.user.firstName,
      lastName:  s.user.lastName,
      email:     s.user.email,
    },
    expiresAt: s.expiresAt,
  };
}

// ── Mobile presign — bypasses normal auth using the session token ────────────

export async function presignMobileUpload(
  rawToken: string,
  kind:     'document' | 'selfie',
  ext:      string,
): Promise<{ signedUrl: string; token: string; path: string; bucket: string }> {
  const session   = await resolveSession(rawToken);
  const safeExt   = (ext || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  const path      = `${session.userId}/id-verification/${session.id}/${kind}-${Date.now()}.${safeExt}`;
  const supabase  = getServiceClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new AppError('Failed to prepare upload', 500);
  return { signedUrl: data.signedUrl, token: data.token, path: data.path, bucket: BUCKET };
}

// ── Complete (mobile finishes capture, persists URLs to user) ───────────────

export async function completeMobileSession(
  rawToken: string,
  payload: {
    documentUrl: string;
    selfieUrl:   string;
    country:     string;
    idType:      string;
  },
): Promise<void> {
  const session = await resolveSession(rawToken);
  const { documentUrl, selfieUrl, country, idType } = payload;
  if (!documentUrl || !selfieUrl || !country || !idType) {
    throw new AppError('Missing required fields', 400);
  }

  await prisma.$transaction([
    prisma.idVerificationSession.update({
      where: { id: session.id },
      data:  {
        status:      'UPLOADED',
        documentUrl,
        selfieUrl,
        country,
        idType,
        completedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: session.userId },
      data:  {
        idDocumentUrl:        documentUrl,
        idSelfieUrl:          selfieUrl,
        idCountry:            country,
        idType,
        idVerificationStatus: 'PENDING',
        idVerifiedAt:         null,
        idVerificationNote:   null,
      },
    }),
  ]);
}
