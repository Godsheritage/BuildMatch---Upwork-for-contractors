/**
 * dispute-notifications.service.ts
 *
 * All outbound email notifications for the dispute system.
 *
 * EMAIL PROVIDER
 * ─────────────
 * No email provider is wired yet.  All mail currently logs to the console.
 * To add a real provider, replace the body of `deliverEmail()` below with any of the
 * commented-out examples (Resend, SendGrid, Postmark) — the rest of the file is
 * provider-agnostic.
 *
 * DEBOUNCE
 * ────────
 * `notifyNewDisputeMessage` is debounced per (dispute × recipient) with a 30-minute
 * in-memory window.  For multi-server deployments, replace the `lastNotifiedAt` Map
 * with a Redis SET or a `user_notified_at` column on the `disputes` table.
 */

import prisma from '../lib/prisma';
import type { Dispute, DisputeStatus } from '../types/dispute.types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotifUser {
  id:        string;
  firstName: string;
  lastName:  string;
  email:     string;
}

export interface NotifJob {
  id:    string;
  title: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const SITE_URL     = (process.env.FRONTEND_URL ?? 'https://buildmatch.com').replace(/\/$/, '');
const FROM_NAME    = 'BuildMatch';
const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'noreply@buildmatch.com';

// ── Provider adapter ──────────────────────────────────────────────────────────
//
// Replace the body of this function with your provider of choice.
//
// ── Resend ───────────────────────────────────────────────────────────────────
// import { Resend } from 'resend';
// const resend = new Resend(process.env.RESEND_API_KEY);
// await resend.emails.send({ from: `${FROM_NAME} <${FROM_ADDRESS}>`, to: msg.to, subject: msg.subject, html: msg.html });
//
// ── SendGrid ──────────────────────────────────────────────────────────────────
// import sgMail from '@sendgrid/mail';
// sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
// await sgMail.send({ from: FROM_ADDRESS, to: msg.to, subject: msg.subject, html: msg.html });
//
// ── Postmark ──────────────────────────────────────────────────────────────────
// import { ServerClient } from 'postmark';
// const client = new ServerClient(process.env.POSTMARK_API_TOKEN!);
// await client.sendEmail({ From: FROM_ADDRESS, To: msg.to, Subject: msg.subject, HtmlBody: msg.html });
//
// ── Nodemailer ────────────────────────────────────────────────────────────────
// import nodemailer from 'nodemailer';
// const transporter = nodemailer.createTransport({ host: ..., port: ..., auth: { user: ..., pass: ... } });
// await transporter.sendMail({ from: `"${FROM_NAME}" <${FROM_ADDRESS}>`, to: msg.to, subject: msg.subject, html: msg.html });

interface EmailMessage {
  to:      string;
  subject: string;
  html:    string;
}

async function deliverEmail(msg: EmailMessage): Promise<void> {
  // TODO: wire in email provider above and delete this log line
  console.log(`[dispute-notifications] → ${msg.to} | ${msg.subject}`);
}

// ── Debounce tracker ──────────────────────────────────────────────────────────
// Key: `${disputeId}:${recipientId}` → last sent timestamp
const lastNotifiedAt            = new Map<string, number>();
const DEBOUNCE_MS               = 30 * 60 * 1_000; // 30 minutes
const DEBOUNCE_TTL_MS           = 24 * 60 * 60 * 1_000; // evict entries older than 24h

// Periodic sweep so the Map cannot grow unbounded on long-running servers.
setInterval(() => {
  const cutoff = Date.now() - DEBOUNCE_TTL_MS;
  for (const [k, ts] of lastNotifiedAt.entries()) {
    if (ts < cutoff) lastNotifiedAt.delete(k);
  }
}, 60 * 60 * 1_000).unref?.();

// ── HTML email builder ────────────────────────────────────────────────────────

interface EmailTemplate {
  heading:    string;
  paragraphs: string[];
  ctaLabel?:  string;
  ctaUrl?:    string;
  footer?:    string;
}

function buildHtml(t: EmailTemplate): string {
  const rows = t.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.6;">${p}</p>`,
    )
    .join('\n            ');

  const ctaBlock = t.ctaUrl
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
              <tr>
                <td>
                  <a href="${t.ctaUrl}"
                     style="display:inline-block;padding:12px 28px;background:#1B3A5C;color:#ffffff;
                            font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;
                            letter-spacing:-0.01em;">
                    ${t.ctaLabel ?? 'View Details'}
                  </a>
                </td>
              </tr>
            </table>`
    : '';

  const footer = t.footer ?? 'You are receiving this email from BuildMatch.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${t.heading}</title>
</head>
<body style="margin:0;padding:0;background:#F8F7F5;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border:1px solid #E5E4E0;border-radius:12px;overflow:hidden;max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding:20px 32px;background:#1B3A5C;">
              <p style="margin:0;font-size:18px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">
                ${FROM_NAME}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#1A1A18;letter-spacing:-0.02em;">
                ${t.heading}
              </h1>
            ${rows}
            ${ctaBlock}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #E5E4E0;background:#F8F7F5;">
              <p style="margin:0;font-size:11px;color:#6B6B67;line-height:1.5;">
                ${footer}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Category label ────────────────────────────────────────────────────────────

function formatCategory(cat: string): string {
  return cat
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Ruling label ──────────────────────────────────────────────────────────────

function formatRuling(ruling: string | null): string {
  if (!ruling) return 'No ruling recorded';
  const labels: Record<string, string> = {
    INVESTOR_WINS:  'Resolved in favour of the investor',
    CONTRACTOR_WINS:'Resolved in favour of the contractor',
    SPLIT:          'Split resolution — partial award to each party',
    WITHDRAWN:      'Withdrawn',
    NO_ACTION:      'No action taken',
  };
  return labels[ruling] ?? ruling;
}

// ── Helper: fetch user with email ─────────────────────────────────────────────

async function fetchUserEmail(
  userId: string,
): Promise<{ firstName: string; lastName: string; email: string } | null> {
  const u = await prisma.user.findUnique({
    where:  { id: userId },
    select: { firstName: true, lastName: true, email: true },
  });
  return u ?? null;
}

// ── notifyDisputeFiled ────────────────────────────────────────────────────────

export async function notifyDisputeFiled(params: {
  dispute:      Dispute;
  filedByUser:  NotifUser;
  againstUser:  NotifUser;
  job:          NotifJob;
}): Promise<void> {
  const { dispute, filedByUser, againstUser, job } = params;

  if (!againstUser.email) return;

  const ctaUrl = `${SITE_URL}/dashboard/settings/disputes/${dispute.id}`;

  const html = buildHtml({
    heading: 'A dispute has been filed against you',
    paragraphs: [
      `${filedByUser.firstName} ${filedByUser.lastName} has filed a dispute on the job <strong>${job.title}</strong>.`,
      `<strong>Category:</strong> ${formatCategory(dispute.category)}`,
      `<strong>Amount in dispute:</strong> $${dispute.amountDisputed.toLocaleString()}`,
      `<strong>What they are asking for:</strong> ${dispute.desiredOutcome}`,
      'You have <strong>5 business days</strong> to respond and submit evidence. Log in to BuildMatch to review the details and add your response.',
    ],
    ctaLabel: 'View Dispute',
    ctaUrl,
    footer: 'You are receiving this because you are a party to this dispute on BuildMatch.',
  });

  await deliverEmail({
    to:      againstUser.email,
    subject: `A dispute has been filed regarding: ${job.title}`,
    html,
  });
}

// ── notifyStatusChange ────────────────────────────────────────────────────────

export async function notifyStatusChange(params: {
  dispute:         Dispute;
  newStatus:       DisputeStatus;
  affectedUserId:  string;
  job:             NotifJob;
}): Promise<void> {
  const { dispute, newStatus, affectedUserId, job } = params;

  const recipient = await fetchUserEmail(affectedUserId);
  if (!recipient?.email) return;

  type StatusConfig = { subject: string; heading: string; paragraphs: string[]; ctaLabel?: string };

  const ctaUrl = `${SITE_URL}/dashboard/settings/disputes/${dispute.id}`;

  const configs: Partial<Record<DisputeStatus, StatusConfig>> = {
    UNDER_REVIEW: {
      subject:    'Your dispute is now under review',
      heading:    'Your dispute is under review',
      paragraphs: [
        `BuildMatch is reviewing the dispute on <strong>${job.title}</strong>.`,
        'You may continue to submit evidence and send messages in the dispute thread. Our team will follow up within 2–3 business days.',
      ],
      ctaLabel: 'View Dispute',
    },
    AWAITING_EVIDENCE: {
      subject:    'Action required: evidence needed for your dispute',
      heading:    'Additional evidence required',
      paragraphs: [
        `BuildMatch requires additional evidence to resolve your dispute on <strong>${job.title}</strong>.`,
        'Please submit supporting photos, documents, or videos as soon as possible. Failure to provide evidence may affect the outcome of your case.',
      ],
      ctaLabel: 'Submit Evidence',
    },
    PENDING_RULING: {
      subject:    'Your dispute is pending a ruling',
      heading:    'Pending ruling — no further evidence required',
      paragraphs: [
        `BuildMatch has reviewed all evidence for your dispute on <strong>${job.title}</strong> and will issue a ruling shortly.`,
        'No further evidence is required at this time. You will be notified as soon as a decision is reached.',
      ],
      ctaLabel: 'View Dispute',
    },
    RESOLVED: {
      subject:    'Your dispute has been resolved',
      heading:    'Your dispute has been resolved',
      paragraphs: [
        `The dispute on <strong>${job.title}</strong> has been resolved.`,
        `<strong>Ruling:</strong> ${formatRuling(dispute.ruling)}`,
        ...(dispute.rulingNote
          ? [`<strong>Notes:</strong> ${dispute.rulingNote}`]
          : []),
        'If you have any questions about this resolution, please contact BuildMatch support.',
      ],
      ctaLabel: 'View Resolution Details',
    },
  };

  const cfg = configs[newStatus];
  if (!cfg) return; // No email for this status transition

  const html = buildHtml({
    heading:    cfg.heading,
    paragraphs: cfg.paragraphs,
    ctaLabel:   cfg.ctaLabel,
    ctaUrl,
    footer: 'You are receiving this because you are a party to this dispute on BuildMatch.',
  });

  await deliverEmail({
    to:      recipient.email,
    subject: cfg.subject,
    html,
  });
}

// ── notifyNewDisputeMessage ───────────────────────────────────────────────────

export async function notifyNewDisputeMessage(params: {
  dispute:         Dispute;
  senderUser:      NotifUser;
  recipientUserId: string;
  job:             NotifJob;
}): Promise<void> {
  const { dispute, senderUser, recipientUserId, job } = params;

  // Debounce: skip if a notification for this dispute→recipient was sent < 30 min ago
  const debounceKey = `${dispute.id}:${recipientUserId}`;
  const lastSent    = lastNotifiedAt.get(debounceKey) ?? 0;
  if (Date.now() - lastSent < DEBOUNCE_MS) return;

  const recipient = await fetchUserEmail(recipientUserId);
  if (!recipient?.email) return;

  // Update debounce tracker before sending so a concurrent call won't double-send
  lastNotifiedAt.set(debounceKey, Date.now());

  const ctaUrl = `${SITE_URL}/dashboard/settings/disputes/${dispute.id}`;

  const html = buildHtml({
    heading: 'New message in your dispute',
    paragraphs: [
      `${senderUser.firstName} ${senderUser.lastName} sent a message in the dispute on <strong>${job.title}</strong>.`,
      'Log in to BuildMatch to read and reply to the message.',
    ],
    ctaLabel: 'View Message',
    ctaUrl,
    footer: 'You are receiving this because you are a party to this dispute on BuildMatch. We limit these emails to once every 30 minutes.',
  });

  await deliverEmail({
    to:      recipient.email,
    subject: `New message in your dispute: ${job.title}`,
    html,
  });
}

// ── notifyDisputeWithdrawn ────────────────────────────────────────────────────

export async function notifyDisputeWithdrawn(params: {
  dispute:          Dispute;
  withdrawnByUser:  NotifUser;
  otherUserId:      string;
  job:              NotifJob;
}): Promise<void> {
  const { dispute, withdrawnByUser, otherUserId, job } = params;

  const recipient = await fetchUserEmail(otherUserId);
  if (!recipient?.email) return;

  const ctaUrl = `${SITE_URL}/dashboard/settings/disputes/${dispute.id}`;

  const html = buildHtml({
    heading: 'Dispute withdrawn',
    paragraphs: [
      `${withdrawnByUser.firstName} ${withdrawnByUser.lastName} has withdrawn the dispute on <strong>${job.title}</strong>.`,
      'Any held funds related to this dispute have been released.',
      'No further action is required on your part.',
    ],
    ctaLabel: 'View Details',
    ctaUrl,
    footer: 'You are receiving this because you are a party to this dispute on BuildMatch.',
  });

  await deliverEmail({
    to:      recipient.email,
    subject: `Dispute withdrawn: ${job.title}`,
    html,
  });
}
