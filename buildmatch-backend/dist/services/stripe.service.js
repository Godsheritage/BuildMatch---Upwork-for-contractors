"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripe = void 0;
exports.createOnboardingLink = createOnboardingLink;
exports.getOnboardingStatus = getOnboardingStatus;
exports.handleAccountUpdated = handleAccountUpdated;
exports.handlePaymentIntentSucceeded = handlePaymentIntentSucceeded;
exports.handleTransferCreated = handleTransferCreated;
exports.constructWebhookEvent = constructWebhookEvent;
const stripe_1 = __importDefault(require("stripe"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const app_error_1 = require("../utils/app-error");
function getStripe() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key)
        throw new app_error_1.AppError('STRIPE_SECRET_KEY is not configured', 500);
    return new stripe_1.default(key, { apiVersion: '2026-03-25.dahlia' });
}
exports.stripe = new Proxy({}, {
    get(_target, prop) {
        return getStripe()[prop];
    },
});
// ── Onboard ───────────────────────────────────────────────────────────────────
async function createOnboardingLink(userId) {
    // Look up or create the Stripe Express account
    let record = await prisma_1.default.contractorStripeAccount.findUnique({ where: { userId } });
    if (!record) {
        const account = await exports.stripe.accounts.create({ type: 'express' });
        record = await prisma_1.default.contractorStripeAccount.create({
            data: {
                userId,
                stripeAccountId: account.id,
            },
        });
    }
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const link = await exports.stripe.accountLinks.create({
        account: record.stripeAccountId,
        refresh_url: `${frontendUrl}/dashboard/payments/onboard/refresh`,
        return_url: `${frontendUrl}/dashboard/payments/onboard/complete`,
        type: 'account_onboarding',
    });
    return link.url;
}
// ── Status ────────────────────────────────────────────────────────────────────
async function getOnboardingStatus(userId) {
    const record = await prisma_1.default.contractorStripeAccount.findUnique({ where: { userId } });
    if (!record) {
        return { isOnboarded: false, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
    }
    // Refresh live data from Stripe
    const account = await exports.stripe.accounts.retrieve(record.stripeAccountId);
    const updated = await prisma_1.default.contractorStripeAccount.update({
        where: { userId },
        data: {
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted,
        },
    });
    return {
        isOnboarded: updated.detailsSubmitted && updated.chargesEnabled,
        chargesEnabled: updated.chargesEnabled,
        payoutsEnabled: updated.payoutsEnabled,
        detailsSubmitted: updated.detailsSubmitted,
    };
}
// ── Webhook handlers ──────────────────────────────────────────────────────────
async function handleAccountUpdated(account) {
    await prisma_1.default.contractorStripeAccount.updateMany({
        where: { stripeAccountId: account.id },
        data: {
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted,
        },
    });
}
async function handlePaymentIntentSucceeded(pi) {
    const escrow = await prisma_1.default.escrowPayment.findUnique({
        where: { stripePaymentIntentId: pi.id },
    });
    if (!escrow)
        return;
    await prisma_1.default.$transaction([
        prisma_1.default.escrowPayment.update({
            where: { id: escrow.id },
            data: { status: 'FUNDED' },
        }),
        prisma_1.default.job.update({
            where: { id: escrow.jobId },
            data: { status: 'IN_PROGRESS' },
        }),
    ]);
}
async function handleTransferCreated(transfer) {
    if (!transfer.id)
        return;
    await prisma_1.default.milestone.updateMany({
        where: { stripeTransferId: transfer.id },
        data: { status: 'RELEASED', releasedAt: new Date() },
    });
}
// ── Signature verification ────────────────────────────────────────────────────
function constructWebhookEvent(payload, sig) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret)
        throw new app_error_1.AppError('Webhook secret not configured', 500);
    return exports.stripe.webhooks.constructEvent(payload, sig, secret);
}
//# sourceMappingURL=stripe.service.js.map