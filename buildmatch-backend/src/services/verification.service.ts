import crypto from 'crypto';
import prisma from '../lib/prisma';
import { sendEmail } from './email.service';
import { AppError } from '../utils/app-error';

// ── Token plumbing (parallel to password-reset.service.ts) ───────────────────

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

// ── Email verification ───────────────────────────────────────────────────────

/**
 * Generate a single-use email verification token, store its hash, and email
 * the link to the user's current address. Already-verified addresses no-op.
 */
export async function requestEmailVerification(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);
  if (user.emailVerifiedAt) {
    // Idempotent: don't re-send if already verified.
    return;
  }

  // One active token per user — clear any prior ones first.
  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });

  const raw       = makeToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.emailVerificationToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const url = `${frontendBaseUrl()}/verify-email?token=${raw}`;

  const html = `
    <div style="font-family:system-ui,sans-serif;color:#1A1A18;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 16px;font-size:20px;">Verify your BuildMatch email</h2>
      <p style="font-size:14px;line-height:1.6;color:#374151;">
        Hi ${user.firstName ?? 'there'},
      </p>
      <p style="font-size:14px;line-height:1.6;color:#374151;">
        Click the button below to verify your email address. The link expires in 24 hours.
      </p>
      <p style="margin:24px 0;">
        <a href="${url}"
           style="display:inline-block;padding:12px 22px;background:#1B3A5C;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
          Verify email
        </a>
      </p>
      <p style="font-size:12px;color:#6B6B67;line-height:1.6;">
        If the button doesn't work, paste this link into your browser:<br/>
        <a href="${url}" style="color:#1B3A5C;word-break:break-all;">${url}</a>
      </p>
    </div>
  `;

  const text = `Verify your BuildMatch email\n\nHi ${user.firstName ?? 'there'},\n\nOpen the link below to verify your email address. It expires in 24 hours.\n\n${url}`;

  void sendEmail({ to: user.email, subject: 'Verify your BuildMatch email', html, text })
    .catch((err) => console.error('[verification] sendEmail failed:', err));
}

/**
 * Consume an email verification token: mark User.emailVerifiedAt and delete
 * the token. All failure modes return the same generic error.
 */
export async function confirmEmailVerification(rawToken: string): Promise<void> {
  if (!rawToken) throw new AppError('Invalid or expired link', 400);
  const tokenHash = hashToken(rawToken);

  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError('Invalid or expired link', 400);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data:  { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);
}

// ── ID document upload ───────────────────────────────────────────────────────

/**
 * Record a newly-uploaded ID document URL on the user and set status to
 * PENDING. The actual upload to Supabase Storage happens client-side via the
 * existing avatar/dispute-evidence pattern; this endpoint just persists the
 * URL and resets the verification status.
 */
export async function submitIdDocument(userId: string, documentUrl: string): Promise<void> {
  if (!documentUrl) throw new AppError('Document URL is required', 400);

  await prisma.user.update({
    where: { id: userId },
    data:  {
      idDocumentUrl:        documentUrl,
      idVerificationStatus: 'PENDING',
      // Reset any previous decision so admins re-review.
      idVerifiedAt:         null,
      idVerificationNote:   null,
    },
  });
}

/**
 * Admin-only — approve or reject a submitted ID document.
 */
export async function reviewIdDocument(
  targetUserId: string,
  decision:     'APPROVED' | 'REJECTED',
  note?:        string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new AppError('User not found', 404);
  if (!user.idDocumentUrl) throw new AppError('No document submitted yet', 400);

  await prisma.user.update({
    where: { id: targetUserId },
    data:  {
      idVerificationStatus: decision,
      idVerifiedAt:         decision === 'APPROVED' ? new Date() : null,
      idVerificationNote:   note ?? null,
    },
  });
}
