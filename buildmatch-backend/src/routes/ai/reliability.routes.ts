import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response.utils';
import prisma from '../../lib/prisma';

const router = Router();

// ── GET /me ───────────────────────────────────────────────────────────────────
// Returns the authenticated contractor's own pre-computed score.

router.get(
  '/me',
  authenticate,
  requireRole('CONTRACTOR'),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;

    const details = await prisma.contractorScoreDetails.findUnique({
      where: { contractorUserId: userId },
    }).catch(() => null);

    if (!details) {
      sendSuccess(res, {
        totalScore:        null,
        responseRatePts:   null,
        onTimePts:         null,
        bidAccuracyPts:    null,
        jobCompletionPts:  null,
        disputeHistoryPts: null,
        explanation:       'Your reliability score will be computed after you complete your first jobs.',
        improvementTips:   [
          'Respond to investor messages quickly.',
          'Deliver work that matches your bid amount.',
          'Complete all milestones on time to build your track record.',
        ],
        computedAt: null,
      });
      return;
    }

    sendSuccess(res, {
      totalScore:        details.totalScore,
      responseRatePts:   details.responseRatePts,
      onTimePts:         details.onTimePts,
      bidAccuracyPts:    details.bidAccuracyPts,
      jobCompletionPts:  details.jobCompletionPts,
      disputeHistoryPts: details.disputeHistoryPts,
      explanation:       details.explanation,
      improvementTips:   details.improvementTips,
      computedAt:        details.computedAt,
    });
  },
);

// ── GET /:contractorId ────────────────────────────────────────────────────────
// Returns the pre-computed score breakdown to the contractor themselves only.

router.get(
  '/:contractorId',
  authenticate,
  requireRole('CONTRACTOR'),
  async (req: Request, res: Response): Promise<void> => {
    const { contractorId } = req.params;

    // contractorId here is a ContractorProfile.id — resolve to userId for auth check
    const profile = await prisma.contractorProfile.findUnique({
      where:  { id: contractorId },
      select: { userId: true },
    }).catch(() => null);

    if (!profile) {
      sendError(res, 'Contractor not found', 404);
      return;
    }

    if (profile.userId !== req.user!.userId) {
      sendError(res, 'You can only view your own reliability score', 403);
      return;
    }

    const details = await prisma.contractorScoreDetails.findUnique({
      where: { contractorUserId: profile.userId },
    }).catch(() => null);

    if (!details) {
      // Score not yet computed — return a placeholder so the UI can handle it
      sendSuccess(res, {
        totalScore:        null,
        responseRatePts:   null,
        onTimePts:         null,
        bidAccuracyPts:    null,
        jobCompletionPts:  null,
        disputeHistoryPts: null,
        explanation:       'Your reliability score will be computed after you complete your first jobs.',
        improvementTips:   [
          'Respond to investor messages quickly.',
          'Deliver work that matches your bid amount.',
          'Complete all milestones on time to build your track record.',
        ],
        computedAt: null,
      });
      return;
    }

    sendSuccess(res, {
      totalScore:        details.totalScore,
      responseRatePts:   details.responseRatePts,
      onTimePts:         details.onTimePts,
      bidAccuracyPts:    details.bidAccuracyPts,
      jobCompletionPts:  details.jobCompletionPts,
      disputeHistoryPts: details.disputeHistoryPts,
      explanation:       details.explanation,
      improvementTips:   details.improvementTips,
      computedAt:        details.computedAt,
    });
  },
);

export default router;
