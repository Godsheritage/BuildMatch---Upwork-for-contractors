"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fundJob = fundJob;
exports.getEscrow = getEscrow;
exports.submitMilestone = submitMilestone;
exports.approveMilestone = approveMilestone;
exports.disputeMilestone = disputeMilestone;
exports.resolveDispute = resolveDispute;
const prisma_1 = __importDefault(require("../lib/prisma"));
const stripe_service_1 = require("./stripe.service");
const app_error_1 = require("../utils/app-error");
const PLATFORM_FEE_RATE = 0.05; // 5%
// ── Helpers ───────────────────────────────────────────────────────────────────
function autoSuggestMilestones(amount) {
    if (amount < 5000) {
        return [{ title: 'Project completion', percentage: 100 }];
    }
    if (amount <= 20000) {
        return [
            { title: 'Kickoff', percentage: 25 },
            { title: 'Mid-point', percentage: 50 },
            { title: 'Final', percentage: 25 },
        ];
    }
    return [
        { title: 'Kickoff', percentage: 20 },
        { title: 'First milestone', percentage: 30 },
        { title: 'Second milestone', percentage: 30 },
        { title: 'Final', percentage: 20 },
    ];
}
function validateMilestones(milestones) {
    if (milestones.length === 0) {
        throw new app_error_1.AppError('At least one milestone is required', 422);
    }
    if (milestones.length > 10) {
        throw new app_error_1.AppError('Maximum 10 milestones allowed', 422);
    }
    const sum = milestones.reduce((acc, m) => acc + m.percentage, 0);
    // Allow a tiny float rounding tolerance
    if (Math.abs(sum - 100) > 0.01) {
        throw new app_error_1.AppError(`Milestone percentages must sum to 100 (got ${sum})`, 422);
    }
}
async function getContractorStripeAccountId(contractorId) {
    const acct = await prisma_1.default.contractorStripeAccount.findUnique({
        where: { userId: contractorId },
    });
    if (!acct || !acct.chargesEnabled) {
        throw new app_error_1.AppError('Contractor has not completed Stripe onboarding', 422);
    }
    return acct.stripeAccountId;
}
async function getEscrowForJob(jobId) {
    const escrow = await prisma_1.default.escrowPayment.findUnique({
        where: { jobId },
        include: { milestones: { orderBy: { order: 'asc' } } },
    });
    if (!escrow)
        throw new app_error_1.AppError('Escrow not found for this job', 404);
    return escrow;
}
// ── Fund job ──────────────────────────────────────────────────────────────────
async function fundJob(jobId, investorId, milestonesInput) {
    // 1. Load job and verify ownership + status
    const job = await prisma_1.default.job.findUnique({ where: { id: jobId } });
    if (!job)
        throw new app_error_1.AppError('Job not found', 404);
    if (job.investorId !== investorId)
        throw new app_error_1.AppError('Forbidden', 403);
    if (job.status !== 'AWARDED') {
        throw new app_error_1.AppError('Job must be in AWARDED status before funding', 422);
    }
    // 2. Check for existing escrow
    const existing = await prisma_1.default.escrowPayment.findUnique({ where: { jobId } });
    if (existing)
        throw new app_error_1.AppError('Escrow already exists for this job', 409);
    // 3. Find the accepted bid to get amount + contractorId
    const acceptedBid = await prisma_1.default.bid.findFirst({
        where: { jobId, status: 'ACCEPTED' },
    });
    if (!acceptedBid)
        throw new app_error_1.AppError('No accepted bid found for this job', 422);
    const totalAmount = acceptedBid.amount;
    const platformFeeAmount = Math.round(totalAmount * PLATFORM_FEE_RATE * 100) / 100;
    const contractorId = acceptedBid.contractorId;
    // 4. Get contractor's Stripe Express account
    const contractorStripeAccountId = await getContractorStripeAccountId(contractorId);
    // 5. Resolve milestones (auto-suggest if empty)
    const milestones = milestonesInput.length === 0
        ? autoSuggestMilestones(totalAmount)
        : milestonesInput;
    validateMilestones(milestones);
    // 6. Create Stripe PaymentIntent
    const paymentIntent = await stripe_service_1.stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100),
        currency: 'usd',
        metadata: { jobId, investorId, contractorId },
        application_fee_amount: Math.round(platformFeeAmount * 100),
        transfer_data: { destination: contractorStripeAccountId },
    });
    // 7. Persist EscrowPayment + Milestones in a transaction
    const escrow = await prisma_1.default.$transaction(async (tx) => {
        const ep = await tx.escrowPayment.create({
            data: {
                jobId,
                investorId,
                contractorId,
                totalAmount,
                platformFeeAmount,
                stripePaymentIntentId: paymentIntent.id,
                status: 'PENDING',
                milestones: {
                    create: milestones.map((m, i) => ({
                        title: m.title,
                        description: m.description,
                        percentage: m.percentage,
                        amount: Math.round(totalAmount * (m.percentage / 100) * 100) / 100,
                        order: i + 1,
                        status: 'PENDING',
                    })),
                },
            },
            include: { milestones: { orderBy: { order: 'asc' } } },
        });
        return ep;
    });
    return { clientSecret: paymentIntent.client_secret, escrowPayment: escrow };
}
// ── Get escrow ────────────────────────────────────────────────────────────────
async function getEscrow(jobId, userId, role) {
    const job = await prisma_1.default.job.findUnique({ where: { id: jobId } });
    if (!job)
        throw new app_error_1.AppError('Job not found', 404);
    // Access: investor who owns it, or the awarded contractor
    if (role === 'INVESTOR' && job.investorId !== userId) {
        throw new app_error_1.AppError('Forbidden', 403);
    }
    if (role === 'CONTRACTOR') {
        const acceptedBid = await prisma_1.default.bid.findFirst({
            where: { jobId, contractorId: userId, status: 'ACCEPTED' },
        });
        if (!acceptedBid)
            throw new app_error_1.AppError('Forbidden', 403);
    }
    return getEscrowForJob(jobId);
}
// ── Submit milestone ──────────────────────────────────────────────────────────
async function submitMilestone(jobId, milestoneId, contractorId, completionNotes) {
    const escrow = await getEscrowForJob(jobId);
    if (escrow.contractorId !== contractorId)
        throw new app_error_1.AppError('Forbidden', 403);
    const milestone = escrow.milestones.find((m) => m.id === milestoneId);
    if (!milestone)
        throw new app_error_1.AppError('Milestone not found', 404);
    if (!['PENDING', 'IN_PROGRESS'].includes(milestone.status)) {
        throw new app_error_1.AppError(`Milestone cannot be submitted from ${milestone.status} status`, 422);
    }
    return prisma_1.default.milestone.update({
        where: { id: milestoneId },
        data: { status: 'SUBMITTED', completionNotes: completionNotes ?? null },
    });
}
// ── Approve milestone ─────────────────────────────────────────────────────────
async function approveMilestone(jobId, milestoneId, investorId) {
    const job = await prisma_1.default.job.findUnique({ where: { id: jobId } });
    if (!job)
        throw new app_error_1.AppError('Job not found', 404);
    if (job.investorId !== investorId)
        throw new app_error_1.AppError('Forbidden', 403);
    const escrow = await getEscrowForJob(jobId);
    const milestone = escrow.milestones.find((m) => m.id === milestoneId);
    if (!milestone)
        throw new app_error_1.AppError('Milestone not found', 404);
    if (milestone.status !== 'SUBMITTED') {
        throw new app_error_1.AppError(`Milestone must be SUBMITTED to approve (current: ${milestone.status})`, 422);
    }
    const contractorStripeAccountId = await getContractorStripeAccountId(escrow.contractorId);
    // Create Stripe transfer
    const transfer = await stripe_service_1.stripe.transfers.create({
        amount: Math.round(milestone.amount * 100),
        currency: 'usd',
        destination: contractorStripeAccountId,
        transfer_group: escrow.id,
    });
    // Update milestone
    const updated = await prisma_1.default.milestone.update({
        where: { id: milestoneId },
        data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            stripeTransferId: transfer.id,
        },
    });
    // Re-fetch milestones to check if all are done
    const allMilestones = await prisma_1.default.milestone.findMany({ where: { escrowPaymentId: escrow.id } });
    const allDone = allMilestones.every((m) => m.id === milestoneId ? true : ['APPROVED', 'RELEASED'].includes(m.status));
    if (allDone) {
        await prisma_1.default.escrowPayment.update({
            where: { id: escrow.id },
            data: { status: 'FULLY_RELEASED' },
        });
    }
    return updated;
}
// ── Dispute milestone ─────────────────────────────────────────────────────────
async function disputeMilestone(jobId, milestoneId, investorId, reason) {
    const job = await prisma_1.default.job.findUnique({ where: { id: jobId } });
    if (!job)
        throw new app_error_1.AppError('Job not found', 404);
    if (job.investorId !== investorId)
        throw new app_error_1.AppError('Forbidden', 403);
    const escrow = await getEscrowForJob(jobId);
    const milestone = escrow.milestones.find((m) => m.id === milestoneId);
    if (!milestone)
        throw new app_error_1.AppError('Milestone not found', 404);
    if (milestone.status !== 'SUBMITTED') {
        throw new app_error_1.AppError(`Milestone must be SUBMITTED to dispute (current: ${milestone.status})`, 422);
    }
    const [updated] = await prisma_1.default.$transaction([
        prisma_1.default.milestone.update({
            where: { id: milestoneId },
            data: { status: 'DISPUTED', disputeReason: reason },
        }),
        prisma_1.default.escrowPayment.update({
            where: { id: escrow.id },
            data: { status: 'DISPUTED' },
        }),
    ]);
    return updated;
}
// ── Resolve dispute ───────────────────────────────────────────────────────────
async function resolveDispute(jobId, milestoneId, resolution) {
    const escrow = await getEscrowForJob(jobId);
    const milestone = escrow.milestones.find((m) => m.id === milestoneId);
    if (!milestone)
        throw new app_error_1.AppError('Milestone not found', 404);
    if (milestone.status !== 'DISPUTED') {
        throw new app_error_1.AppError(`Milestone must be DISPUTED to resolve (current: ${milestone.status})`, 422);
    }
    if (resolution === 'RELEASE') {
        const contractorStripeAccountId = await getContractorStripeAccountId(escrow.contractorId);
        const transfer = await stripe_service_1.stripe.transfers.create({
            amount: Math.round(milestone.amount * 100),
            currency: 'usd',
            destination: contractorStripeAccountId,
            transfer_group: escrow.id,
        });
        const updated = await prisma_1.default.milestone.update({
            where: { id: milestoneId },
            data: {
                status: 'APPROVED',
                approvedAt: new Date(),
                stripeTransferId: transfer.id,
                disputeReason: null,
            },
        });
        // Check full release
        const allMilestones = await prisma_1.default.milestone.findMany({ where: { escrowPaymentId: escrow.id } });
        const allDone = allMilestones.every((m) => m.id === milestoneId ? true : ['APPROVED', 'RELEASED'].includes(m.status));
        if (allDone) {
            await prisma_1.default.escrowPayment.update({
                where: { id: escrow.id },
                data: { status: 'FULLY_RELEASED' },
            });
        }
        else {
            await prisma_1.default.escrowPayment.update({
                where: { id: escrow.id },
                data: { status: 'IN_PROGRESS' },
            });
        }
        return updated;
    }
    // REFUND path
    if (!escrow.stripePaymentIntentId) {
        throw new app_error_1.AppError('No payment intent found for this escrow', 422);
    }
    await stripe_service_1.stripe.refunds.create({
        payment_intent: escrow.stripePaymentIntentId,
        amount: Math.round(milestone.amount * 100),
    });
    const updated = await prisma_1.default.milestone.update({
        where: { id: milestoneId },
        data: { status: 'RELEASED', releasedAt: new Date(), disputeReason: null },
    });
    // Check if all milestones resolved
    const allMilestones = await prisma_1.default.milestone.findMany({ where: { escrowPaymentId: escrow.id } });
    const allResolved = allMilestones.every((m) => m.id === milestoneId ? true : ['APPROVED', 'RELEASED', 'REFUNDED'].includes(m.status));
    await prisma_1.default.escrowPayment.update({
        where: { id: escrow.id },
        data: { status: allResolved ? 'REFUNDED' : 'IN_PROGRESS' },
    });
    return updated;
}
//# sourceMappingURL=escrow.service.js.map