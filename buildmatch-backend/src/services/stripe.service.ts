import Stripe from 'stripe';
import prisma from '../lib/prisma';
import { AppError } from '../utils/app-error';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new AppError('STRIPE_SECRET_KEY is not configured', 500);
  return new Stripe(key, { apiVersion: '2026-03-25.dahlia' });
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

// ── Onboard ───────────────────────────────────────────────────────────────────

export async function createOnboardingLink(userId: string): Promise<string> {
  // Look up or create the Stripe Express account
  let record = await prisma.contractorStripeAccount.findUnique({ where: { userId } });

  if (!record) {
    const account = await stripe.accounts.create({ type: 'express' });
    record = await prisma.contractorStripeAccount.create({
      data: {
        userId,
        stripeAccountId: account.id,
      },
    });
  }

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  const link = await stripe.accountLinks.create({
    account: record.stripeAccountId,
    refresh_url: `${frontendUrl}/dashboard/payments/onboard/refresh`,
    return_url:  `${frontendUrl}/dashboard/payments/onboard/complete`,
    type: 'account_onboarding',
  });

  return link.url;
}

// ── Status ────────────────────────────────────────────────────────────────────

export async function getOnboardingStatus(userId: string) {
  const record = await prisma.contractorStripeAccount.findUnique({ where: { userId } });
  if (!record) {
    return { isOnboarded: false, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
  }

  // Refresh live data from Stripe
  const account = await stripe.accounts.retrieve(record.stripeAccountId);

  const updated = await prisma.contractorStripeAccount.update({
    where: { userId },
    data: {
      chargesEnabled:   account.charges_enabled,
      payoutsEnabled:   account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    },
  });

  return {
    isOnboarded:      updated.detailsSubmitted && updated.chargesEnabled,
    chargesEnabled:   updated.chargesEnabled,
    payoutsEnabled:   updated.payoutsEnabled,
    detailsSubmitted: updated.detailsSubmitted,
  };
}

// ── Webhook handlers ──────────────────────────────────────────────────────────

export async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  await prisma.contractorStripeAccount.updateMany({
    where: { stripeAccountId: account.id },
    data: {
      chargesEnabled:   account.charges_enabled,
      payoutsEnabled:   account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    },
  });
}

export async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  const escrow = await prisma.escrowPayment.findUnique({
    where: { stripePaymentIntentId: pi.id },
  });
  if (!escrow) return;

  await prisma.$transaction([
    prisma.escrowPayment.update({
      where: { id: escrow.id },
      data: { status: 'FUNDED' },
    }),
    prisma.job.update({
      where: { id: escrow.jobId },
      data: { status: 'IN_PROGRESS' },
    }),
  ]);
}

export async function handleTransferCreated(transfer: Stripe.Transfer): Promise<void> {
  if (!transfer.id) return;

  await prisma.milestone.updateMany({
    where: { stripeTransferId: transfer.id },
    data: { status: 'RELEASED', releasedAt: new Date() },
  });
}

// ── Signature verification ────────────────────────────────────────────────────

export function constructWebhookEvent(payload: Buffer, sig: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new AppError('Webhook secret not configured', 500);
  return stripe.webhooks.constructEvent(payload, sig, secret);
}
