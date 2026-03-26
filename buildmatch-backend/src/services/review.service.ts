import prisma from '../lib/prisma';
import { AppError } from '../utils/app-error';
import type { CreateReviewInput } from '../schemas/review.schemas';

// ── Shared selects ────────────────────────────────────────────────────────────

const REVIEWER_SELECT = {
  select: { firstName: true, lastName: true },
} as const;

// ── Complete a job ─────────────────────────────────────────────────────────────

export async function completeJob(jobId: string, investorId: string) {
  const job = await prisma.job.findUnique({
    where:   { id: jobId },
    include: { escrowPayment: { include: { milestones: true } } },
  });

  if (!job)                          throw new AppError('Job not found', 404);
  if (job.investorId !== investorId) throw new AppError('Forbidden', 403);
  if (job.status !== 'IN_PROGRESS')  throw new AppError('Job must be IN_PROGRESS to complete', 400);

  // All milestones must be RELEASED (if escrow exists)
  if (job.escrowPayment) {
    const unreleased = job.escrowPayment.milestones.filter(
      (m) => m.status !== 'RELEASED' && m.status !== 'APPROVED',
    );
    if (unreleased.length > 0) {
      throw new AppError('All milestones must be released before completing the job', 400);
    }
  }

  // Find the accepted bid to get contractor userId
  const acceptedBid = await prisma.bid.findFirst({
    where: { jobId, status: 'ACCEPTED' },
  });

  const [updatedJob] = await prisma.$transaction(async (tx) => {
    const j = await tx.job.update({
      where: { id: jobId },
      data:  { status: 'COMPLETED', isCompleted: true, reviewsUnlocked: true },
    });

    if (acceptedBid) {
      await tx.contractorProfile.updateMany({
        where: { userId: acceptedBid.contractorId },
        data:  { completedJobs: { increment: 1 } },
      });
    }

    return [j];
  });

  return updatedJob;
}

// ── Create review ─────────────────────────────────────────────────────────────

export async function createReview(
  jobId:      string,
  reviewerId: string,
  reviewerRole: 'INVESTOR' | 'CONTRACTOR' | 'ADMIN',
  input:      CreateReviewInput,
) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });
  if (!job)                    throw new AppError('Job not found', 404);
  if (!job.reviewsUnlocked)    throw new AppError('Reviews are not unlocked for this job', 403);

  // Determine reviewee
  let revieweeId: string;

  if (reviewerRole === 'INVESTOR') {
    // Investor reviews the contractor
    if (job.investorId !== reviewerId) throw new AppError('Forbidden', 403);

    const acceptedBid = await prisma.bid.findFirst({
      where: { jobId, status: 'ACCEPTED' },
    });
    if (!acceptedBid) throw new AppError('No accepted contractor found on this job', 400);
    revieweeId = acceptedBid.contractorId;

  } else if (reviewerRole === 'CONTRACTOR') {
    // Contractor reviews the investor
    const myBid = await prisma.bid.findFirst({
      where: { jobId, contractorId: reviewerId, status: 'ACCEPTED' },
    });
    if (!myBid) throw new AppError('Forbidden — you are not the contractor on this job', 403);
    revieweeId = job.investorId;

  } else {
    throw new AppError('Admins cannot submit reviews', 403);
  }

  const review = await prisma.review.create({
    data: {
      jobId,
      reviewerId,
      revieweeId,
      reviewerRole,
      rating: input.rating,
      title:  input.title,
      body:   input.body,
    },
    include: {
      reviewer: REVIEWER_SELECT,
    },
  });

  // Recalculate contractor's averageRating + totalReviews when the reviewee is a contractor
  if (reviewerRole === 'INVESTOR') {
    const agg = await prisma.review.aggregate({
      where:   { revieweeId },
      _avg:    { rating: true },
      _count:  { rating: true },
    });
    await prisma.contractorProfile.updateMany({
      where: { userId: revieweeId },
      data: {
        averageRating: agg._avg.rating ?? 0,
        totalReviews:  agg._count.rating,
      },
    });
  }

  return review;
}

// ── List reviews for a contractor ─────────────────────────────────────────────

export async function listContractorReviews(
  contractorUserId: string,
  page:  number,
  limit: number,
  sort:  'newest' | 'highest' | 'lowest',
) {
  const skip = (page - 1) * limit;

  const orderBy =
    sort === 'highest' ? { rating: 'desc' as const } :
    sort === 'lowest'  ? { rating: 'asc'  as const } :
                         { createdAt: 'desc' as const };

  const where = { revieweeId: contractorUserId };

  const [reviews, total, breakdownRaw] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take:    limit,
      orderBy,
      select: {
        id:           true,
        rating:       true,
        title:        true,
        body:         true,
        reviewerRole: true,
        createdAt:    true,
        reviewer:     { select: { firstName: true, lastName: true } },
        job:          { select: { title: true, tradeType: true } },
      },
    }),
    prisma.review.count({ where }),
    prisma.review.groupBy({
      by:    ['rating'],
      where,
      _count: { rating: true },
    }),
  ]);

  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    rating: star,
    count:  breakdownRaw.find((b) => b.rating === star)?._count.rating ?? 0,
  }));

  return {
    reviews,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    breakdown,
  };
}

// ── List reviews for a job ────────────────────────────────────────────────────

export async function listJobReviews(jobId: string, requesterId: string, requesterRole: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);

  // Must be investor or accepted contractor
  const isInvestor   = job.investorId === requesterId;
  const isContractor = await prisma.bid.findFirst({
    where: { jobId, contractorId: requesterId, status: 'ACCEPTED' },
  });

  if (!isInvestor && !isContractor && requesterRole !== 'ADMIN') {
    throw new AppError('Forbidden', 403);
  }

  return prisma.review.findMany({
    where:   { jobId },
    orderBy: { createdAt: 'desc' },
    select: {
      id:           true,
      rating:       true,
      title:        true,
      body:         true,
      reviewerRole: true,
      createdAt:    true,
      reviewer:     { select: { firstName: true, lastName: true } },
    },
  });
}
