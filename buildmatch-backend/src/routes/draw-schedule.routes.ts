import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AppError } from '../utils/app-error';
import prisma from '../lib/prisma';
import { generateDrawSchedule } from '../services/ai/draw-schedule.service';
import { approveMilestone } from '../services/escrow.service';
import { fileDispute } from '../services/dispute.service';
import {
  notifyScheduleReady,
  notifyPartyApproved,
  notifyScheduleLocked,
  notifyDrawRequested,
  notifyDrawApproved,
  notifyDrawDisputed,
} from '../services/draw-notifications.service';

// mergeParams exposes :jobId from the parent mount path inside this router
const router = Router({ mergeParams: true });

router.use(authenticate);

// ── requireJobParty middleware ─────────────────────────────────────────────────

export async function requireJobParty(
  req:  Request,
  res:  Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { jobId } = req.params;
    const userId    = req.user!.userId;

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      sendError(res, 'Job not found', 404);
      return;
    }

    const isParty = job.investorId === userId || job.contractorId === userId;
    if (!isParty) {
      sendError(res, 'Access denied — you are not a party to this job', 403);
      return;
    }

    req.job = job;
    next();
  } catch (err) {
    console.error('[draw-schedule] requireJobParty error:', err);
    sendError(res, 'An unexpected error occurred', 500);
  }
}

router.use(requireJobParty);

// ── Validation schemas ────────────────────────────────────────────────────────

const editMilestoneSchema = z.object({
  title:              z.string().min(3).max(100).optional(),
  description:        z.string().max(500).optional(),
  completionCriteria: z.string().min(10).max(500).optional(),
  percentage:         z.number().min(1).max(50).optional(),
  dueDateDays:        z.number().int().min(1).max(730).optional(),
});

const addMilestoneSchema = z.object({
  title:              z.string().min(3).max(100),
  description:        z.string().max(500),
  completionCriteria: z.string().min(10).max(500),
  percentage:         z.number().min(1).max(50),
  afterDrawNumber:    z.number().int().min(0).optional(),
});

// ── Shared helpers ────────────────────────────────────────────────────────────

function handleErr(tag: string, res: Response, err: unknown): void {
  if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
  console.error(`[draw-schedule] ${tag}:`, err);
  sendError(res, 'An unexpected error occurred', 500);
}

/** Reset both party approvals and transition PENDING_APPROVAL → NEGOTIATING or DRAFT → NEGOTIATING */
async function resetApprovals(scheduleId: string, fromStatus: string) {
  await prisma.drawSchedule.update({
    where: { id: scheduleId },
    data: {
      investorApprovedAt:   null,
      contractorApprovedAt: null,
      status: fromStatus === 'DRAFT' ? 'DRAFT' : 'NEGOTIATING',
    },
  });
}

// ── GET /api/jobs/:jobId/draws ─────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const schedule = await prisma.drawSchedule.findUnique({
      where:   { jobId: req.params.jobId },
      include: {
        milestones: {
          orderBy: { drawNumber: 'asc' },
          include: {
            drawRequests: {
              orderBy: { createdAt: 'desc' },
              include: {
                evidence:   true,
                contractor: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });
    sendSuccess(res, { schedule: schedule ?? null });
  } catch (err) {
    handleErr('GET /', res, err);
  }
});

// ── POST /api/jobs/:jobId/draws/generate ──────────────────────────────────────
// Static segment — must be declared before /:milestoneId routes.

router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const job    = req.job!;
    const userId = req.user!.userId;

    if (job.investorId !== userId) {
      sendError(res, 'Only the investor can generate a draw schedule', 403);
      return;
    }
    if (job.status !== 'AWARDED') {
      sendError(res, 'Draw schedule can only be generated after a bid is accepted (status AWARDED)', 409);
      return;
    }

    const existing = await prisma.drawSchedule.findUnique({ where: { jobId: job.id } });
    if (existing) {
      sendError(res, 'A draw schedule already exists for this job', 409);
      return;
    }

    const acceptedBid = await prisma.bid.findFirst({
      where: { jobId: job.id, status: 'ACCEPTED' },
    });

    // Calls AI service — which generates milestones and saves them to the DB
    await generateDrawSchedule({
      jobId:          job.id,
      jobTitle:       job.title,
      jobDescription: job.description,
      tradeType:      job.tradeType,
      totalBudget:    acceptedBid?.amount ?? job.budgetMax,
      bidMessage:     acceptedBid?.message,
    });

    // Fetch the persisted schedule to return a fully typed Prisma response
    const schedule = await prisma.drawSchedule.findUnique({
      where:   { jobId: job.id },
      include: { milestones: { orderBy: { drawNumber: 'asc' } } },
    });

    // Notify contractor the schedule is ready — fire-and-forget
    if (job.contractorId) {
      notifyScheduleReady(job.investorId, job.contractorId, job.title).catch(console.error);
    }

    sendSuccess(res, { schedule }, undefined, 201);
  } catch (err) {
    handleErr('POST /generate', res, err);
  }
});

// ── POST /api/jobs/:jobId/draws/approve ───────────────────────────────────────

router.post('/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const job    = req.job!;
    const userId = req.user!.userId;

    const schedule = await prisma.drawSchedule.findUnique({ where: { jobId: job.id } });
    if (!schedule) {
      sendError(res, 'No draw schedule found for this job', 404);
      return;
    }
    if (schedule.status === 'LOCKED') {
      sendError(res, 'Schedule is already locked', 409);
      return;
    }

    const isInvestor   = job.investorId   === userId;
    const isContractor = job.contractorId === userId;

    const now             = new Date();
    const investorApproved   = isInvestor   ? now : schedule.investorApprovedAt;
    const contractorApproved = isContractor ? now : schedule.contractorApprovedAt;
    const bothApproved       = !!(investorApproved && contractorApproved);

    const updated = await prisma.drawSchedule.update({
      where: { id: schedule.id },
      data:  {
        investorApprovedAt:   isInvestor   ? now : undefined,
        contractorApprovedAt: isContractor ? now : undefined,
        status:               bothApproved ? 'LOCKED'           : 'PENDING_APPROVAL',
        lockedAt:             bothApproved ? now                : undefined,
      },
      include: { milestones: { orderBy: { drawNumber: 'asc' } } },
    });

    if (bothApproved) {
      // Lock the job flag
      await prisma.job.update({
        where: { id: job.id },
        data:  { drawScheduleLocked: true },
      });

      // Insert system message into job conversation
      const conversation = await prisma.conversation.findFirst({ where: { jobId: job.id } });
      if (conversation) {
        await prisma.conversationMessage.create({
          data: {
            conversationId: conversation.id,
            senderId:       userId,
            content:        'Draw schedule locked by both parties. Contract is now ready to sign.',
          },
        });
      }

      // Email both parties — fire-and-forget
      if (job.contractorId) {
        notifyScheduleLocked(job.investorId, job.contractorId, job.title, job.id).catch(console.error);
      }
    } else {
      // One party approved — notify the other
      const otherPartyId = isInvestor ? job.contractorId : job.investorId;
      if (otherPartyId) {
        prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } })
          .then((u) => {
            if (u) notifyPartyApproved(otherPartyId!, `${u.firstName} ${u.lastName}`, job.title, job.id).catch(console.error);
          })
          .catch(console.error);
      }
    }

    sendSuccess(res, { schedule: updated });
  } catch (err) {
    handleErr('POST /approve', res, err);
  }
});

// ── POST /api/jobs/:jobId/draws/reset-approval ────────────────────────────────

router.post('/reset-approval', async (req: Request, res: Response): Promise<void> => {
  try {
    const job    = req.job!;
    const userId = req.user!.userId;

    const schedule = await prisma.drawSchedule.findUnique({ where: { jobId: job.id } });
    if (!schedule) {
      sendError(res, 'No draw schedule found', 404);
      return;
    }
    if (schedule.status === 'LOCKED') {
      sendError(res, 'Cannot reset approval on a locked schedule', 409);
      return;
    }
    if (schedule.status !== 'PENDING_APPROVAL') {
      sendError(res, 'Schedule is not in PENDING_APPROVAL status', 409);
      return;
    }

    const isInvestor = job.investorId === userId;

    const updated = await prisma.drawSchedule.update({
      where: { id: schedule.id },
      data:  {
        investorApprovedAt:   isInvestor  ? null : undefined,
        contractorApprovedAt: !isInvestor ? null : undefined,
        status:               'NEGOTIATING',
      },
      include: { milestones: { orderBy: { drawNumber: 'asc' } } },
    });

    // Notify the other party that changes were requested — fire-and-forget
    const otherId = isInvestor ? job.contractorId : job.investorId;
    if (otherId) {
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } })
        .then((u) => {
          if (u) console.log(`[draw-schedule] Changes requested by ${u.firstName} ${u.lastName} on job ${job.id} — notify ${otherId}`);
        })
        .catch(console.error);
    }

    sendSuccess(res, { schedule: updated });
  } catch (err) {
    handleErr('POST /reset-approval', res, err);
  }
});

// ── POST /api/jobs/:jobId/draws/milestones ─────────────────────────────────────

router.post('/milestones', async (req: Request, res: Response): Promise<void> => {
  const parsed = addMilestoneSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);
    return;
  }
  try {
    const job      = req.job!;
    const { title, description, completionCriteria, percentage, afterDrawNumber } = parsed.data;

    const schedule = await prisma.drawSchedule.findUnique({
      where:   { jobId: job.id },
      include: { milestones: { orderBy: { drawNumber: 'asc' } } },
    });
    if (!schedule) {
      sendError(res, 'No draw schedule found', 404);
      return;
    }
    if (schedule.status === 'LOCKED') {
      sendError(res, 'Cannot add milestones to a locked schedule', 409);
      return;
    }
    if (schedule.milestones.length >= 8) {
      sendError(res, 'Maximum of 8 draws per schedule', 400);
      return;
    }

    const currentTotal = schedule.milestones.reduce((s, m) => s + m.percentage, 0);
    if (currentTotal + percentage > 100) {
      sendError(res, `Adding ${percentage}% would push the total to ${currentTotal + percentage}%. All draws must sum to 100%.`, 400);
      return;
    }

    const insertAfter = afterDrawNumber ?? schedule.milestones[schedule.milestones.length - 1]?.drawNumber ?? 0;
    const newDrawNumber = insertAfter + 1;

    // Increment drawNumber of all milestones that come after the insertion point
    await prisma.$transaction(
      schedule.milestones
        .filter((m) => m.drawNumber >= newDrawNumber)
        .map((m) =>
          prisma.drawMilestone.update({
            where: { id: m.id },
            data:  { drawNumber: m.drawNumber + 1 },
          }),
        ),
    );

    const amount = Math.round((percentage / 100) * schedule.totalAmount * 100) / 100;
    const newMilestone = await prisma.drawMilestone.create({
      data: {
        scheduleId:         schedule.id,
        jobId:              job.id,
        drawNumber:         newDrawNumber,
        title,
        description,
        completionCriteria,
        percentage,
        amount,
      },
    });

    await prisma.drawScheduleEdit.create({
      data: {
        scheduleId:  schedule.id,
        editedById:  req.user!.userId,
        editType:    'ADD_DRAW',
        milestoneId: newMilestone.id,
        newValues:   { title, description, completionCriteria, percentage, amount, drawNumber: newDrawNumber },
      },
    });

    await resetApprovals(schedule.id, schedule.status);

    sendSuccess(res, { milestone: newMilestone }, undefined, 201);
  } catch (err) {
    handleErr('POST /milestones', res, err);
  }
});

// ── PUT /api/jobs/:jobId/draws/milestones/:milestoneId ────────────────────────

router.put('/milestones/:milestoneId', async (req: Request, res: Response): Promise<void> => {
  const parsed = editMilestoneSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);
    return;
  }
  try {
    const job         = req.job!;
    const { milestoneId } = req.params;
    const { title, description, completionCriteria, percentage, dueDateDays } = parsed.data;

    const schedule = await prisma.drawSchedule.findUnique({
      where:   { jobId: job.id },
      include: { milestones: true },
    });
    if (!schedule) {
      sendError(res, 'No draw schedule found', 404);
      return;
    }
    if (schedule.status === 'LOCKED') {
      sendError(res, 'Cannot edit a locked schedule', 409);
      return;
    }

    const milestone = schedule.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      sendError(res, 'Milestone not found', 404);
      return;
    }

    // If percentage is changing, verify the new total still equals 100
    if (percentage !== undefined) {
      const otherPctSum = schedule.milestones
        .filter((m) => m.id !== milestoneId)
        .reduce((s, m) => s + m.percentage, 0);
      const newTotal = otherPctSum + percentage;
      if (Math.abs(newTotal - 100) > 0.01) {
        sendError(
          res,
          `Changing this draw to ${percentage}% would make the total ${newTotal.toFixed(2)}% (must be exactly 100%). Adjust other draws first.`,
          400,
        );
        return;
      }
    }

    const newAmount    = percentage !== undefined
      ? Math.round((percentage / 100) * schedule.totalAmount * 100) / 100
      : undefined;
    const newDueDate   = dueDateDays !== undefined
      ? new Date(Date.now() + dueDateDays * 86_400_000)
      : undefined;

    const oldValues = {
      title:              milestone.title,
      description:        milestone.description,
      completionCriteria: milestone.completionCriteria,
      percentage:         milestone.percentage,
      amount:             milestone.amount,
      dueDate:            milestone.dueDate,
    };

    const updated = await prisma.drawMilestone.update({
      where: { id: milestoneId },
      data:  {
        title:              title,
        description:        description,
        completionCriteria: completionCriteria,
        percentage:         percentage,
        amount:             newAmount,
        dueDate:            newDueDate,
      },
    });

    await prisma.drawScheduleEdit.create({
      data: {
        scheduleId:  schedule.id,
        editedById:  req.user!.userId,
        editType:    'EDIT_DRAW',
        milestoneId: milestone.id,
        oldValues,
        newValues:   parsed.data,
      },
    });

    // Advance status from DRAFT to NEGOTIATING on first edit; reset any prior approvals
    await resetApprovals(schedule.id, schedule.status);

    sendSuccess(res, { milestone: updated });
  } catch (err) {
    handleErr('PUT /milestones/:id', res, err);
  }
});

// ── DELETE /api/jobs/:jobId/draws/milestones/:milestoneId ─────────────────────

router.delete('/milestones/:milestoneId', async (req: Request, res: Response): Promise<void> => {
  try {
    const job             = req.job!;
    const { milestoneId } = req.params;

    const schedule = await prisma.drawSchedule.findUnique({
      where:   { jobId: job.id },
      include: { milestones: { orderBy: { drawNumber: 'asc' } } },
    });
    if (!schedule) {
      sendError(res, 'No draw schedule found', 404);
      return;
    }
    if (schedule.status === 'LOCKED') {
      sendError(res, 'Cannot remove milestones from a locked schedule', 409);
      return;
    }
    if (schedule.milestones.length <= 2) {
      sendError(res, 'A schedule must have at least 2 draws', 400);
      return;
    }

    const toRemove = schedule.milestones.find((m) => m.id === milestoneId);
    if (!toRemove) {
      sendError(res, 'Milestone not found', 404);
      return;
    }

    const remaining    = schedule.milestones.filter((m) => m.id !== milestoneId);
    const removedPct   = toRemove.percentage;
    const remainingSum = remaining.reduce((s, m) => s + m.percentage, 0);

    // Distribute the freed percentage proportionally across remaining milestones
    let runningNewTotal = 0;
    const redistributed = remaining.map((m, i) => {
      const isLast = i === remaining.length - 1;
      const newPct = isLast
        ? 100 - runningNewTotal
        : Math.round((m.percentage + removedPct * (m.percentage / remainingSum)) * 100) / 100;
      runningNewTotal += isLast ? newPct : newPct;
      return {
        id:         m.id,
        drawNumber: i + 1,
        percentage: newPct,
        amount:     Math.round((newPct / 100) * schedule.totalAmount * 100) / 100,
      };
    });

    await prisma.$transaction([
      prisma.drawMilestone.delete({ where: { id: milestoneId } }),
      ...redistributed.map((r) =>
        prisma.drawMilestone.update({
          where: { id: r.id },
          data:  { drawNumber: r.drawNumber, percentage: r.percentage, amount: r.amount },
        }),
      ),
      prisma.drawScheduleEdit.create({
        data: {
          scheduleId: schedule.id,
          editedById: req.user!.userId,
          editType:   'REMOVE_DRAW',
          oldValues:  { title: toRemove.title, percentage: removedPct, drawNumber: toRemove.drawNumber },
        },
      }),
    ]);

    await resetApprovals(schedule.id, schedule.status);

    const refreshed = await prisma.drawSchedule.findUnique({
      where:   { id: schedule.id },
      include: { milestones: { orderBy: { drawNumber: 'asc' } } },
    });
    sendSuccess(res, { schedule: refreshed });
  } catch (err) {
    handleErr('DELETE /milestones/:id', res, err);
  }
});

// ── POST /api/jobs/:jobId/draws/milestones/:milestoneId/request ───────────────
// Contractor submits a draw request for a milestone.

const submitDrawRequestSchema = z.object({
  note:             z.string().max(500).optional(),
  evidenceUrls:     z.array(z.string().url()).max(10).optional(),
  evidenceCaptions: z.array(z.string().max(200)).max(10).optional(),
});

router.post(
  '/milestones/:milestoneId/request',
  async (req: Request, res: Response): Promise<void> => {
    const parsed = submitDrawRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }
    try {
      const job         = req.job!;
      const userId      = req.user!.userId;
      const { milestoneId } = req.params;

      if (job.contractorId !== userId) {
        sendError(res, 'Only the awarded contractor can submit draw requests', 403);
        return;
      }
      if (!job.drawScheduleLocked) {
        sendError(res, 'Draw schedule must be locked before submitting draw requests', 409);
        return;
      }

      const milestone = await prisma.drawMilestone.findUnique({ where: { id: milestoneId } });
      if (!milestone || milestone.jobId !== job.id) {
        sendError(res, 'Milestone not found', 404);
        return;
      }
      if (milestone.status !== 'PENDING') {
        sendError(res, `Cannot request draw — milestone is ${milestone.status}`, 409);
        return;
      }

      // Prerequisite: previous draw must be RELEASED (except draw 1)
      if (milestone.drawNumber > 1) {
        const prev = await prisma.drawMilestone.findFirst({
          where: { jobId: job.id, drawNumber: milestone.drawNumber - 1 },
        });
        if (!prev || prev.status !== 'RELEASED') {
          sendError(res, `Draw ${milestone.drawNumber - 1} must be RELEASED before requesting draw ${milestone.drawNumber}`, 409);
          return;
        }
      }

      // Check no open request already exists
      const existing = await prisma.drawRequest.findFirst({
        where: { milestoneId, status: { in: ['PENDING', 'DISPUTED'] } },
      });
      if (existing) {
        sendError(res, 'An open draw request for this milestone already exists', 409);
        return;
      }

      const { note, evidenceUrls = [], evidenceCaptions = [] } = parsed.data;

      const [request] = await prisma.$transaction([
        prisma.drawRequest.create({
          data: {
            milestoneId,
            jobId:        job.id,
            contractorId: userId,
            amount:       milestone.amount,
            note:         note ?? null,
          },
        }),
        prisma.drawMilestone.update({
          where: { id: milestoneId },
          data:  { status: 'REQUESTED', requestedAt: new Date() },
        }),
      ]);

      // Attach evidence rows (fire-and-forget if any)
      if (evidenceUrls.length > 0) {
        await prisma.drawEvidence.createMany({
          data: evidenceUrls.map((url, i) => ({
            drawRequestId: request.id,
            milestoneId,
            uploadedById:  userId,
            url,
            caption:       evidenceCaptions[i] ?? null,
          })),
        });
      }

      // Notify investor — fire-and-forget
      notifyDrawRequested(job.investorId, milestone.drawNumber, milestone.title, milestone.amount, job.title, job.id).catch(console.error);

      const full = await prisma.drawRequest.findUnique({
        where:   { id: request.id },
        include: { evidence: true },
      });

      sendSuccess(res, { request: full }, undefined, 201);
    } catch (err) {
      handleErr('POST /milestones/:id/request', res, err);
    }
  },
);

// ── GET /api/jobs/:jobId/draws/milestones/:milestoneId/request ────────────────
// Returns the current draw request (and evidence) for a milestone.

router.get(
  '/milestones/:milestoneId/request',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const job             = req.job!;
      const { milestoneId } = req.params;

      const milestone = await prisma.drawMilestone.findUnique({ where: { id: milestoneId } });
      if (!milestone || milestone.jobId !== job.id) {
        sendError(res, 'Milestone not found', 404);
        return;
      }

      const request = await prisma.drawRequest.findFirst({
        where:   { milestoneId },
        orderBy: { createdAt: 'desc' },
        include: {
          evidence:   true,
          contractor: { select: { id: true, firstName: true, lastName: true } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      sendSuccess(res, { request: request ?? null });
    } catch (err) {
      handleErr('GET /milestones/:id/request', res, err);
    }
  },
);

// ── POST /api/jobs/:jobId/draws/requests/:requestId/approve ──────────────────
// Investor approves a draw request; triggers escrow release (best-effort Stripe).

router.post(
  '/requests/:requestId/approve',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const job         = req.job!;
      const userId      = req.user!.userId;
      const { requestId } = req.params;

      if (job.investorId !== userId) {
        sendError(res, 'Only the investor can approve draw requests', 403);
        return;
      }

      const request = await prisma.drawRequest.findUnique({ where: { id: requestId } });
      if (!request || request.jobId !== job.id) {
        sendError(res, 'Draw request not found', 404);
        return;
      }
      if (request.status !== 'PENDING') {
        sendError(res, `Request is already ${request.status}`, 409);
        return;
      }

      const now = new Date();

      await prisma.$transaction([
        prisma.drawRequest.update({
          where: { id: requestId },
          data:  { status: 'APPROVED', reviewedById: userId, reviewedAt: now },
        }),
        prisma.drawMilestone.update({
          where: { id: request.milestoneId },
          data:  { status: 'RELEASED', approvedAt: now, releasedAt: now },
        }),
      ]);

      // Best-effort Stripe escrow release — do not block response on failure
      approveMilestone(job.id, request.milestoneId, userId).catch((err: unknown) => {
        console.error('[draw-schedule] approveMilestone (Stripe) error:', err);
      });

      // Notify contractor — fire-and-forget (need milestone for drawNumber)
      if (job.contractorId) {
        prisma.drawMilestone.findUnique({ where: { id: request.milestoneId }, select: { drawNumber: true } })
          .then((m) => {
            if (m) notifyDrawApproved(job.contractorId!, m.drawNumber, request.amount, job.title, job.id).catch(console.error);
          })
          .catch(console.error);
      }

      const updated = await prisma.drawRequest.findUnique({
        where:   { id: requestId },
        include: { evidence: true },
      });

      sendSuccess(res, { request: updated });
    } catch (err) {
      handleErr('POST /requests/:id/approve', res, err);
    }
  },
);

// ── POST /api/jobs/:jobId/draws/requests/:requestId/dispute ──────────────────
// Investor files a dispute on a draw request.

const disputeDrawSchema = z.object({
  category:       z.enum(['INCOMPLETE_WORK', 'WORK_NOT_STARTED', 'QUALITY_ISSUES', 'TIMELINE_BREACH', 'PAYMENT_DISPUTE', 'OTHER']),
  description:    z.string().min(20).max(2000),
  desiredOutcome: z.string().min(10).max(500),
});

router.post(
  '/requests/:requestId/dispute',
  async (req: Request, res: Response): Promise<void> => {
    const parsed = disputeDrawSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }
    try {
      const job           = req.job!;
      const userId        = req.user!.userId;
      const { requestId } = req.params;

      if (job.investorId !== userId) {
        sendError(res, 'Only the investor can dispute a draw request', 403);
        return;
      }

      const request = await prisma.drawRequest.findUnique({
        where:   { id: requestId },
        include: { milestone: true },
      });
      if (!request || request.jobId !== job.id) {
        sendError(res, 'Draw request not found', 404);
        return;
      }
      if (request.status !== 'PENDING') {
        sendError(res, `Cannot dispute a request that is already ${request.status}`, 409);
        return;
      }

      const { category, description, desiredOutcome } = parsed.data;

      // Create the dispute via the shared dispute service
      const dispute = await fileDispute(
        {
          jobId:          job.id,
          milestoneDraw:  request.milestone.drawNumber,
          amountDisputed: request.amount,
          category,
          description,
          desiredOutcome,
        },
        userId,
      );

      // Mark the request and milestone as DISPUTED
      await prisma.$transaction([
        prisma.drawRequest.update({
          where: { id: requestId },
          data:  { status: 'DISPUTED', disputeId: dispute.id },
        }),
        prisma.drawMilestone.update({
          where: { id: request.milestoneId },
          data:  { status: 'DISPUTED' },
        }),
      ]);

      // Notify contractor — fire-and-forget
      if (job.contractorId) {
        notifyDrawDisputed(job.contractorId, request.milestone.drawNumber, job.title).catch(console.error);
      }

      sendSuccess(res, { dispute, requestId }, undefined, 201);
    } catch (err) {
      handleErr('POST /requests/:id/dispute', res, err);
    }
  },
);

// ── POST /api/jobs/:jobId/draws/requests/:requestId/evidence ─────────────────
// Contractor adds evidence to a PENDING or DISPUTED draw request.

const addEvidenceSchema = z.object({
  url:     z.string().url(),
  caption: z.string().max(200).optional(),
});

router.post(
  '/requests/:requestId/evidence',
  async (req: Request, res: Response): Promise<void> => {
    const parsed = addEvidenceSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }
    try {
      const job           = req.job!;
      const userId        = req.user!.userId;
      const { requestId } = req.params;

      if (job.contractorId !== userId) {
        sendError(res, 'Only the contractor can add evidence to a draw request', 403);
        return;
      }

      const request = await prisma.drawRequest.findUnique({ where: { id: requestId } });
      if (!request || request.jobId !== job.id) {
        sendError(res, 'Draw request not found', 404);
        return;
      }
      if (request.contractorId !== userId) {
        sendError(res, 'Access denied', 403);
        return;
      }
      if (!['PENDING', 'DISPUTED'].includes(request.status)) {
        sendError(res, `Cannot add evidence to a request with status ${request.status}`, 409);
        return;
      }

      const { url, caption } = parsed.data;

      const evidence = await prisma.drawEvidence.create({
        data: {
          drawRequestId: requestId,
          milestoneId:   request.milestoneId,
          uploadedById:  userId,
          url,
          caption:       caption ?? null,
        },
      });

      console.log(`[draw-schedule] Evidence added to request ${requestId} on job ${job.id} — investor ${job.investorId} to be notified`);

      sendSuccess(res, { evidence }, undefined, 201);
    } catch (err) {
      handleErr('POST /requests/:id/evidence', res, err);
    }
  },
);

export default router;
