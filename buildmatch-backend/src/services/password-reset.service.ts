import crypto from 'crypto';
import prisma from '../lib/prisma';
import { hashPassword } from '../utils/password.utils';
import { sendEmail } from './email.service';
import { AppError } from '../utils/app-error';

// ── Token plumbing ───────────────────────────────────────────────────────────

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function makeToken(): string {
  // 256 bits of entropy → 64-char hex string
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function frontendBaseUrl(): string {
  // FRONTEND_URL may be a comma-separated allow-list (CORS); the first entry
  // is the canonical user-facing app URL.
  const raw = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  return raw.split(',')[0]!.trim().replace(/\/$/, '');
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Always succeeds — never reveals whether the email exists. If the email
 * matches an account, generate a single-use reset token and email a link.
 * Otherwise no-op silently.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return;

  const user = await prisma.user.findUnique({ where: { email: normalised } });
  if (!user) return;

  // One active token per user — clear any prior ones first.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const raw       = makeToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const url = `${frontendBaseUrl()}/reset-password?token=${raw}`;

  const html = `
    <div style="font-family:system-ui,sans-serif;color:#1A1A18;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 16px;font-size:20px;">Reset your BuildMatch password</h2>
      <p style="font-size:14px;line-height:1.6;color:#374151;">
        Hi ${user.firstName ?? 'there'},
      </p>
      <p style="font-size:14px;line-height:1.6;color:#374151;">
        We received a request to reset the password for your BuildMatch account.
        Click the button below to choose a new one. This link expires in 1 hour
        and can only be used once.
      </p>
      <p style="margin:24px 0;">
        <a href="${url}"
           style="display:inline-block;padding:12px 22px;background:#1B3A5C;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
          Reset password
        </a>
      </p>
      <p style="font-size:12px;color:#6B6B67;line-height:1.6;">
        If the button doesn't work, paste this link into your browser:<br/>
        <a href="${url}" style="color:#1B3A5C;word-break:break-all;">${url}</a>
      </p>
      <p style="font-size:12px;color:#6B6B67;line-height:1.6;margin-top:24px;">
        If you didn't request this, you can safely ignore this email — your
        password won't change.
      </p>
    </div>
  `;

  const text = `Reset your BuildMatch password\n\nHi ${user.firstName ?? 'there'},\n\nWe received a request to reset the password for your BuildMatch account. Open the link below to choose a new one — it expires in 1 hour and can only be used once.\n\n${url}\n\nIf you didn't request this, you can safely ignore this email.`;

  // Fire-and-forget: never let an email failure block the API response.
  void sendEmail({ to: user.email, subject: 'Reset your BuildMatch password', html, text })
    .catch((err) => console.error('[password-reset] sendEmail failed:', err));
}

/**
 * Probe a token without consuming it. Used by the reset page to decide
 * whether to render the form or an "expired" message before the user types.
 */
export async function verifyResetToken(rawToken: string): Promise<{ email: string }> {
  if (!rawToken) throw new AppError('Invalid or expired link', 400);
  const tokenHash = hashToken(rawToken);

  const record = await prisma.passwordResetToken.findUnique({
    where:   { tokenHash },
    include: { user: { select: { email: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError('Invalid or expired link', 400);
  }

  // Lightly mask the email for the UI hint
  const [name, domain] = record.user.email.split('@');
  const masked = name && domain
    ? `${name.slice(0, 2)}${'•'.repeat(Math.max(1, name.length - 2))}@${domain}`
    : record.user.email;

  return { email: masked };
}

/**
 * Consume a token and set the new password atomically. Success deletes the
 * token. All failure modes return the same generic error message.
 */
export async function consumeResetToken(rawToken: string, newPassword: string): Promise<void> {
  if (!rawToken) throw new AppError('Invalid or expired link', 400);
  const tokenHash = hashToken(rawToken);

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError('Invalid or expired link', 400);
  }

  const hashed = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data:  { password: hashed },
    }),
    // Single-use: delete the token (and any siblings, defensively)
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);
}
