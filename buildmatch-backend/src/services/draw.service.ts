import prisma from '../lib/prisma';
import { AppError } from '../utils/app-error';
import { generateDrawSchedule } from './ai/draw-schedule.service';
import type {
  CreateDrawScheduleInput,
  UpdateMilestoneInput,
  SubmitDrawRequestInput,
  ReviewDrawRequestInput,
  AddEvidenceInput,
} from '../schemas/draw.schemas';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Fetch schedule and assert the calling user is party to the job. */
async function assertParty(
  jobId:  string,
  userId: string,
  role:   'INVESTOR' | 'CONTRACTOR' | 'ANY',
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);

  if (role === 'INVESTOR' && job.investorId !== userId)
    throw new AppError('Only the investor can perform this action', 403);
  if (role === 'CONTRACTOR' && job.contractorId !== userId)
    throw new AppError('Only the awarded contractor can perform this action', 403);
  if (role === 'ANY' && job.investorId !== userId && job.contractorId !== userId)
    throw new AppError('Access denied', 403);

  return job;
}

// ── Generate (AI preview, nothing saved) ──────────────────────────────────────

export async function previewDrawSchedule(jobId: string, totalAmount: number) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);

  return generateDrawSchedule({
    jobId,
    jobTitle:       job.title,
    jobDescription: job.description,
    tradeType:      job.tradeType,
    totalBudget:    totalAmount,
  });
}

// ── Create schedule ────────────────────────────────────────────────────────────

export async function createDrawSchedule(
  jobId:   string,
  userId:  string,
  input:   CreateDrawScheduleInput,
) {
  const job = await assertParty(jobId, userId, 'INVESTOR');
  if (job.drawScheduleLocked) throw new AppError('Draw schedule is already locked', 409);

  // Delete existing DRAFT/NEGOTIATING schedule if the investor is regenerating
  const existing = await prisma.drawSchedule.findUnique({ where: { jobId } });
  if (existing) {
    if (existing.status === 'LOCKED')
      throw new AppError('Cannot replace a locked schedule', 409);
    await prisma.drawSchedule.delete({ where: { id: existing.id } });
  }

  const schedule = await prisma.drawSchedule.create({
    data: {
      jobId,
      status:      'DRAFT',
      totalAmount: input.totalAmount,
      drawCount:   input.milestones.length,
      aiGenerated: input.aiGenerated,
      milestones: {
        create: input.milestones.map((m) => ({
          jobId,
          drawNumber:          m.drawNumber,
          title:               m.title,
          description:         m.description,
          completionCriteria:  m.completionCriteria,
          percentage:          m.percentage,
          amount:              m.amount,
          dueDate:             m.dueDate ? new Date(m.dueDate) : null,
        })),
      },
    },
    include: { milestones: { orderBy: { drawNumber: 'asc' } } },
  });

  return schedule;
}

// ── Get schedule ───────────────────────────────────────────────────────────────

export async function getDrawSchedule(jobId: string, userId: string) {
  await assertParty(jobId, userId, 'ANY');

  const schedule = await prisma.drawSchedule.findUnique({
    where:   { jobId },
    include: {
      milestones: {
        orderBy:  { drawNumber: 'asc' },
        include: {
          drawRequests: {
            orderBy: { createdAt: 'desc' },
            include: {
              evidence: true,
              contractor: { select: { id: true, firstName: true, lastName: true } },
              reviewedBy: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  if (!schedule) throw new AppError('No draw schedule found for this job', 404);
  return schedule;
}

// ── Update milestone (negotiation) ────────────────────────────────────────────

export async function updateMilestone(
  jobId:       string,
  milestoneId: string,
  userId:      string,
  input:       UpdateMilestoneInput,
) {
  const job = await assertParty(jobId, userId, 'ANY');

  const milestone = await prisma.drawMilestone.findUnique({
    where:   { id: milestoneId },
    include: { schedule: true },
  });
  if (!milestone || milestone.jobId !== jobId)
    throw new AppError('Milestone not found', 404);
  if (milestone.schedule.status === 'LOCKED')
    throw new AppError('Cannot edit a locked schedule', 409);

  // Record the edit for the negotiation log
  await prisma.drawScheduleEdit.create({
    data: {
      scheduleId:  milestone.scheduleId,
      editedById:  userId,
      editType:    'EDIT_DRAW',
      milestoneId: milestone.id,
      oldValues:   {
        title:              milestone.title,
        description:        milestone.description,
        completionCriteria: milestone.completionCriteria,
        percentage:         milestone.percentage,
        amount:             milestone.amount,
        dueDate:            milestone.dueDate,
      },
      newValues: input,
    },
  });

  // Bump schedule to NEGOTIATING once a party edits it
  if (milestone.schedule.status === 'DRAFT') {
    await prisma.drawSchedule.update({
      where: { id: milestone.scheduleId },
      data:  { status: 'NEGOTIATING', investorApprovedAt: null, contractorApprovedAt: null },
    });
  } else if (milestone.schedule.status === 'PENDING_APPROVAL') {
    // Reset approvals if someone edits after one party already approved
    await prisma.drawSchedule.update({
      where: { id: milestone.scheduleId },
      data:  { status: 'NEGOTIATING', investorApprovedAt: null, contractorApprovedAt: null },
    });
  }

  return prisma.drawMilestone.update({
    where: { id: milestoneId },
    data:  {
      title:              input.title,
      description:        input.description,
      completionCriteria: input.completionCriteria,
      percentage:         input.percentage,
      amount:             input.amount,
      dueDate:            input.dueDate !== undefined
                            ? (input.dueDate ? new Date(input.dueDate) : null)
                            : undefined,
    },
  });
}

// ── Approve schedule ───────────────────────────────────────────────────────────

export async function approveSchedule(jobId: string, userId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);

  const isInvestor   = job.investorId   === userId;
  const isContractor = job.contractorId === userId;
  if (!isInvestor && !isContractor) throw new AppError('Access denied', 403);

  const schedule = await prisma.drawSchedule.findUnique({ where: { jobId } });
  if (!schedule) throw new AppError('No draw schedule found', 404);
  if (schedule.status === 'LOCKED') throw new AppError('Schedule already locked', 409);

  const now = new Date();
  const update: Record<string, unknown> = {};

  if (isInvestor)   update.investorApprovedAt   = now;
  if (isContractor) update.contractorApprovedAt = now;

  // Determine new status
  const investorApproved   = isInvestor   ? now : schedule.investorApprovedAt;
  const contractorApproved = isContractor ? now : schedule.contractorApprovedAt;

  if (investorApproved && contractorApproved) {
    update.status   = 'LOCKED';
    update.lockedAt = now;
    // Also lock the job flag
    await prisma.job.update({ where: { id: jobId }, data: { drawScheduleLocked: true } });
  } else {
    update.status = 'PENDING_APPROVAL';
  }

  return prisma.drawSchedule.update({
    where:   { id: schedule.id },
    data:    update,
    include: { milestones: { orderBy: { drawNumber: 'asc' } } },
  });
}

// ── Submit draw request (contractor) ──────────────────────────────────────────

export async function submitDrawRequest(
  jobId:       string,
  milestoneId: string,
  userId:      string,
  input:       SubmitDrawRequestInput,
) {
  const job = await assertParty(jobId, userId, 'CONTRACTOR');
  if (!job.drawScheduleLocked)
    throw new AppError('Draw schedule must be locked before submitting draw requests', 409);

  const milestone = await prisma.drawMilestone.findUnique({ where: { id: milestoneId } });
  if (!milestone || milestone.jobId !== jobId)
    throw new AppError('Milestone not found', 404);
  if (milestone.status !== 'PENDING')
    throw new AppError(`Cannot request draw in status ${milestone.status}`, 409);

  // Check there is no active request already
  const existing = await prisma.drawRequest.findFirst({
    where: { milestoneId, status: { in: ['PENDING', 'DISPUTED'] } },
  });
  if (existing) throw new AppError('A draw request for this milestone is already open', 409);

  const [request] = await prisma.$transaction([
    prisma.drawRequest.create({
      data: {
        milestoneId,
        jobId,
        contractorId: userId,
        amount:       milestone.amount,
        note:         input.note ?? null,
      },
    }),
    prisma.drawMilestone.update({
      where: { id: milestoneId },
      data:  { status: 'REQUESTED', requestedAt: new Date() },
    }),
  ]);

  return request;
}

// ── Review draw request (investor) ────────────────────────────────────────────

export async function reviewDrawRequest(
  jobId:     string,
  requestId: string,
  userId:    string,
  input:     ReviewDrawRequestInput,
) {
  await assertParty(jobId, userId, 'INVESTOR');

  const request = await prisma.drawRequest.findUnique({ where: { id: requestId } });
  if (!request || request.jobId !== jobId) throw new AppError('Draw request not found', 404);
  if (request.status !== 'PENDING') throw new AppError(`Request is already ${request.status}`, 409);

  const now = new Date();

  if (input.action === 'APPROVE') {
    await prisma.$transaction([
      prisma.drawRequest.update({
        where: { id: requestId },
        data:  { status: 'APPROVED', reviewedById: userId, reviewedAt: now },
      }),
      prisma.drawMilestone.update({
        where: { id: request.milestoneId },
        data:  { status: 'APPROVED', approvedAt: now },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.drawRequest.update({
        where: { id: requestId },
        data:  {
          status:          'REJECTED',
          reviewedById:    userId,
          reviewedAt:      now,
          rejectionReason: input.rejectionReason,
        },
      }),
      prisma.drawMilestone.update({
        where: { id: request.milestoneId },
        data:  { status: 'PENDING' }, // reset so contractor can resubmit
      }),
    ]);
  }

  return prisma.drawRequest.findUnique({
    where:   { id: requestId },
    include: { evidence: true },
  });
}

// ── Add evidence to draw request ───────────────────────────────────────────────

export async function addDrawEvidence(
  jobId:     string,
  requestId: string,
  userId:    string,
  input:     AddEvidenceInput,
) {
  const job = await assertParty(jobId, userId, 'CONTRACTOR');

  const request = await prisma.drawRequest.findUnique({ where: { id: requestId } });
  if (!request || request.jobId !== jobId) throw new AppError('Draw request not found', 404);
  if (request.contractorId !== userId) throw new AppError('Access denied', 403);
  if (request.status === 'APPROVED') throw new AppError('Cannot add evidence to an approved request', 409);

  return prisma.drawEvidence.create({
    data: {
      drawRequestId: requestId,
      milestoneId:   request.milestoneId,
      uploadedById:  userId,
      url:           input.url,
      caption:       input.caption ?? null,
    },
  });
}

// ── List draw requests for investor ───────────────────────────────────────────

export async function listDrawRequests(jobId: string, userId: string) {
  await assertParty(jobId, userId, 'ANY');

  return prisma.drawRequest.findMany({
    where:   { jobId },
    orderBy: { createdAt: 'desc' },
    include: {
      milestone: true,
      evidence:  true,
      contractor: { select: { id: true, firstName: true, lastName: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}
