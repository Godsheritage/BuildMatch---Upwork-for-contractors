/**
 * draw-notifications.service.ts
 *
 * All outbound email notifications for the draw schedule and draw request system.
 *
 * EMAIL PROVIDER
 * ─────────────
 * No email provider is wired yet.  All mail currently logs to the console.
 * To add a real provider, replace the body of `deliverEmail()` with any of the
 * provider adapters shown in the comments — the rest of the file is provider-agnostic.
 *
 * USAGE
 * ─────
 * All exported functions are async and are called fire-and-forget:
 *   notifyScheduleReady(investorId, contractorId, jobTitle).catch(console.error);
 */

import prisma from '../lib/prisma';
import { isOptedIn } from './notification-prefs.service';

// ── Config ────────────────────────────────────────────────────────────────────

const SITE_URL     = (process.env.FRONTEND_URL ?? 'https://buildmatch.com').replace(/\/$/, '');
const FROM_NAME    = 'BuildMatch';
const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'noreply@buildmatch.com';

// ── Provider adapter ─────────────────────────────────────────────────────────
//
// Replace the body of deliverEmail() with your provider of choice:
//
// ── Resend ────────────────────────────────────────────────────────────────────
// import { Resend } from 'resend';
// const resend = new Resend(process.env.RESEND_API_KEY);
// await resend.emails.send({ from: `${FROM_NAME} <${FROM_ADDRESS}>`, to, subject, html });
//
// ── SendGrid ──────────────────────────────────────────────────────────────────
// import sgMail from '@sendgrid/mail';
// sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
// await sgMail.send({ from: FROM_ADDRESS, to, subject, html });

async function deliverEmail(opts: {
  to:      string;
  subject: string;
  html:    string;
}): Promise<void> {
  console.log(
    `[draw-notifications] → ${opts.to} | ${opts.subject}`,
  );
  void FROM_NAME; void FROM_ADDRESS; // suppress unused-var lint until provider is wired
}

// ── User lookup helper ────────────────────────────────────────────────────────

async function getUser(userId: string) {
  return prisma.user.findUnique({
    where:  { id: userId },
    select: { email: true, firstName: true, lastName: true },
  });
}

// ── Notification functions ────────────────────────────────────────────────────

/**
 * Notify contractor that the investor has set up the draw schedule.
 * Called after the investor generates the AI draw schedule (POST /draws/generate).
 */
export async function notifyScheduleReady(
  investorId:   string,
  contractorId: string,
  jobTitle:     string,
): Promise<void> {
  const [investor, contractor] = await Promise.all([
    getUser(investorId),
    getUser(contractorId),
  ]);
  if (!contractor || !investor) return;
  if (!(await isOptedIn(contractorId, 'drawUpdates'))) return;

  const investorName = `${investor.firstName} ${investor.lastName}`;

  await deliverEmail({
    to:      contractor.email,
    subject: `Draw schedule ready for "${jobTitle}"`,
    html: `
      <p>Hi ${contractor.firstName},</p>
      <p>${investorName} has set up the draw schedule for <strong>${jobTitle}</strong>.
      Review and approve it to proceed to contract signing.</p>
      <p><a href="${SITE_URL}/jobs/draw-schedule">View Draw Schedule →</a></p>
      <p>— BuildMatch</p>
    `,
  });
}

/**
 * Notify the other party that someone has approved the draw schedule.
 * Called after each individual approval (POST /draws/approve) when NOT yet locked.
 */
export async function notifyPartyApproved(
  otherPartyId: string,
  approverName: string,
  jobTitle:     string,
  jobId:        string,
): Promise<void> {
  const other = await getUser(otherPartyId);
  if (!other) return;
  if (!(await isOptedIn(otherPartyId, 'drawUpdates'))) return;

  await deliverEmail({
    to:      other.email,
    subject: `Draw schedule approved by ${approverName} — "${jobTitle}"`,
    html: `
      <p>Hi ${other.firstName},</p>
      <p><strong>${approverName}</strong> has approved the draw schedule for
      <strong>${jobTitle}</strong>. Review and approve it to lock it in and proceed
      to contract signing.</p>
      <p><a href="${SITE_URL}/jobs/${jobId}/draw-schedule">Review Draw Schedule →</a></p>
      <p>— BuildMatch</p>
    `,
  });
}

/**
 * Notify both parties that the draw schedule is now locked.
 * Called after POST /draws/approve when both parties have approved (schedule → LOCKED).
 */
export async function notifyScheduleLocked(
  investorId:   string,
  contractorId: string,
  jobTitle:     string,
  jobId:        string,
): Promise<void> {
  const [investor, contractor] = await Promise.all([
    getUser(investorId),
    getUser(contractorId),
  ]);

  const body = (firstName: string) => `
    <p>Hi ${firstName},</p>
    <p>The draw schedule for <strong>${jobTitle}</strong> is now locked by both parties.
    You can proceed to sign the contract.</p>
    <p><a href="${SITE_URL}/jobs/${jobId}/draw-schedule">View Draw Schedule →</a></p>
    <p>— BuildMatch</p>
  `;

  const sends: Promise<void>[] = [];
  if (investor && (await isOptedIn(investorId, 'drawUpdates'))) {
    sends.push(deliverEmail({
      to:      investor.email,
      subject: `Draw schedule locked — sign the contract for "${jobTitle}"`,
      html:    body(investor.firstName),
    }));
  }
  if (contractor && (await isOptedIn(contractorId, 'drawUpdates'))) {
    sends.push(deliverEmail({
      to:      contractor.email,
      subject: `Draw schedule locked — sign the contract for "${jobTitle}"`,
      html:    body(contractor.firstName),
    }));
  }

  await Promise.all(sends);
}

/**
 * Notify investor that the contractor has submitted a draw request.
 * Called after POST /draws/milestones/:id/request.
 */
export async function notifyDrawRequested(
  investorId:  string,
  drawNumber:  number,
  drawTitle:   string,
  amount:      number,
  jobTitle:    string,
  jobId:       string,
): Promise<void> {
  const investor = await getUser(investorId);
  if (!investor) return;
  if (!(await isOptedIn(investorId, 'drawUpdates'))) return;

  const fmtAmount = `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  await deliverEmail({
    to:      investor.email,
    subject: `Draw ${drawNumber} requested: "${drawTitle}" — ${jobTitle}`,
    html: `
      <p>Hi ${investor.firstName},</p>
      <p>Your contractor has requested <strong>Draw ${drawNumber}: ${drawTitle}</strong>
      (${fmtAmount}) for <strong>${jobTitle}</strong>.</p>
      <p>Review the evidence and approve or dispute within 3 business days.</p>
      <p><a href="${SITE_URL}/jobs/${jobId}">Review Request →</a></p>
      <p>— BuildMatch</p>
    `,
  });
}

/**
 * Notify contractor that a draw request has been approved and funds released.
 * Called after POST /draws/requests/:id/approve.
 */
export async function notifyDrawApproved(
  contractorId: string,
  drawNumber:   number,
  amount:       number,
  jobTitle:     string,
  jobId:        string,
): Promise<void> {
  const contractor = await getUser(contractorId);
  if (!contractor) return;
  if (!(await isOptedIn(contractorId, 'drawUpdates'))) return;

  const fmtAmount = `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  await deliverEmail({
    to:      contractor.email,
    subject: `Draw ${drawNumber} approved — ${fmtAmount} released for "${jobTitle}"`,
    html: `
      <p>Hi ${contractor.firstName},</p>
      <p>Draw ${drawNumber} has been approved! <strong>${fmtAmount}</strong> has been
      released to your account for <strong>${jobTitle}</strong>.</p>
      <p><a href="${SITE_URL}/jobs/${jobId}">View Job →</a></p>
      <p>— BuildMatch</p>
    `,
  });
}

/**
 * Notify contractor that a draw request has been disputed.
 * Called after POST /draws/requests/:id/dispute.
 */
export async function notifyDrawDisputed(
  contractorId: string,
  drawNumber:   number,
  jobTitle:     string,
): Promise<void> {
  const contractor = await getUser(contractorId);
  if (!contractor) return;
  if (!(await isOptedIn(contractorId, 'drawUpdates'))) return;

  await deliverEmail({
    to:      contractor.email,
    subject: `Draw ${drawNumber} disputed — "${jobTitle}"`,
    html: `
      <p>Hi ${contractor.firstName},</p>
      <p>Draw ${drawNumber} for <strong>${jobTitle}</strong> has been disputed by the investor.</p>
      <p>View and respond to the dispute in your Dispute Centre:</p>
      <p><a href="${SITE_URL}/dashboard/settings/disputes">View Dispute Centre →</a></p>
      <p>— BuildMatch</p>
    `,
  });
}
