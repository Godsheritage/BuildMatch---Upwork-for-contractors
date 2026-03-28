import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AppError } from '../utils/app-error';
import { generateContract } from '../services/ai/contract-generator.service';
import prisma from '../lib/prisma';

const router = Router();

// ── Rate limiters ─────────────────────────────────────────────────────────────

const generateRateLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req: Request) => req.user?.userId ?? req.ip ?? 'anon',
  handler:         (_req: Request, res: Response) => {
    sendError(res, 'Too many contract generation requests. Please try again later.', 429);
  },
});

// ── Zod schemas ───────────────────────────────────────────────────────────────

const GenerateContractSchema = z.object({
  jobId: z.string().min(1),
  bidId: z.string().min(1),
});

// ── GET /by-job/:jobId ────────────────────────────────────────────────────────
// Returns the most recent active/pending contract for a job, or null.
// Both investor and contractor party can call this.

router.get(
  '/by-job/:jobId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;
    const userId    = req.user!.userId;

    try {
      const contract = await prisma.contract.findFirst({
        where: {
          jobId,
          OR: [{ investorId: userId }, { contractorId: userId }],
        },
        orderBy: { createdAt: 'desc' },
      });

      sendSuccess(res, contract ?? null);
    } catch (err) {
      console.error('[contracts.routes] GET /by-job error:', err);
      sendError(res, 'Something went wrong', 500);
    }
  },
);

// ── POST /generate ────────────────────────────────────────────────────────────

router.post(
  '/generate',
  authenticate,
  requireRole('INVESTOR'),
  generateRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = GenerateContractSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
      return;
    }

    try {
      const contract = await generateContract({
        jobId:      parsed.data.jobId,
        bidId:      parsed.data.bidId,
        investorId: req.user!.userId,
      });
      sendSuccess(res, contract, 'Contract generated successfully', 201);
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.statusCode);
        return;
      }
      console.error('[contracts.routes] POST /generate error:', err);
      sendError(res, 'Contract generation temporarily unavailable. Please try again.', 503);
    }
  },
);

// ── GET /:contractId ──────────────────────────────────────────────────────────

router.get(
  '/:contractId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { contractId } = req.params;
    const userId         = req.user!.userId;

    try {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
      });

      if (!contract) {
        sendError(res, 'Contract not found', 404);
        return;
      }

      if (contract.investorId !== userId && contract.contractorId !== userId) {
        sendError(res, 'You do not have access to this contract', 403);
        return;
      }

      sendSuccess(res, contract);
    } catch (err) {
      console.error('[contracts.routes] GET /:contractId error:', err);
      sendError(res, 'Something went wrong', 500);
    }
  },
);

// ── POST /:contractId/sign ────────────────────────────────────────────────────

router.post(
  '/:contractId/sign',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { contractId } = req.params;
    const userId         = req.user!.userId;
    const callerIp       = req.ip ?? 'unknown';

    try {
      const contract = await prisma.contract.findUnique({
        where:  { id: contractId },
        select: {
          id: true, investorId: true, contractorId: true, status: true,
          investorSignedAt: true, contractorSignedAt: true, jobId: true,
        },
      });

      if (!contract) {
        sendError(res, 'Contract not found', 404);
        return;
      }

      if (contract.investorId !== userId && contract.contractorId !== userId) {
        sendError(res, 'You are not a party to this contract', 403);
        return;
      }

      if (contract.status !== 'PENDING_SIGNATURES') {
        sendError(res, `Contract cannot be signed in status: ${contract.status}`, 400);
        return;
      }

      const isInvestor   = contract.investorId   === userId;
      const isContractor = contract.contractorId === userId;

      // Prevent double-signing
      if (isInvestor   && contract.investorSignedAt)   {
        sendError(res, 'You have already signed this contract', 400);
        return;
      }
      if (isContractor && contract.contractorSignedAt) {
        sendError(res, 'You have already signed this contract', 400);
        return;
      }

      // Record signature
      const updateData: Record<string, unknown> = {};
      if (isInvestor) {
        updateData.investorSignedAt = new Date();
        updateData.investorIp       = callerIp;
      } else {
        updateData.contractorSignedAt = new Date();
        updateData.contractorIp       = callerIp;
      }

      // After recording, check if both parties have now signed
      const willBothSigned =
        (isInvestor   && !!contract.contractorSignedAt) ||
        (isContractor && !!contract.investorSignedAt);

      if (willBothSigned) {
        updateData.status = 'ACTIVE';
      }

      const updated = await prisma.contract.update({
        where: { id: contractId },
        data:  updateData,
      });

      // If both signed → mark job IN_PROGRESS
      if (willBothSigned) {
        await prisma.job.update({
          where: { id: contract.jobId },
          data:  { status: 'IN_PROGRESS' },
        }).catch((err) => console.error('[contracts.routes] job status update failed:', err));
      }

      sendSuccess(res, updated, willBothSigned ? 'Contract is now active' : 'Signature recorded');
    } catch (err) {
      console.error('[contracts.routes] POST /:contractId/sign error:', err);
      sendError(res, 'Something went wrong', 500);
    }
  },
);

// ── GET /:contractId/pdf ──────────────────────────────────────────────────────

router.get(
  '/:contractId/pdf',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { contractId } = req.params;
    const userId         = req.user!.userId;

    try {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
      });

      if (!contract) {
        sendError(res, 'Contract not found', 404);
        return;
      }

      if (contract.investorId !== userId && contract.contractorId !== userId) {
        sendError(res, 'You do not have access to this contract', 403);
        return;
      }

      // Build PDF
      const doc = new PDFDocument({ margin: 60, size: 'LETTER' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="contract-${contract.id.slice(-8)}.pdf"`,
      );
      doc.pipe(res);

      // ── Title block ───────────────────────────────────────────────────────
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(contract.title, { align: 'center' })
        .moveDown(0.5);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#555555')
        .text(`Contract ID: ${contract.id}`, { align: 'center' })
        .text(`Status: ${contract.status}`, { align: 'center' })
        .text(`Generated: ${contract.createdAt.toLocaleDateString()}`, { align: 'center' })
        .fillColor('#000000')
        .moveDown(1);

      // ── Signature status ──────────────────────────────────────────────────
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Signature Status')
        .moveDown(0.3);

      doc
        .font('Helvetica')
        .fontSize(10)
        .text(`Investor signed: ${contract.investorSignedAt ? contract.investorSignedAt.toLocaleString() : 'Pending'}`)
        .text(`Contractor signed: ${contract.contractorSignedAt ? contract.contractorSignedAt.toLocaleString() : 'Pending'}`)
        .moveDown(1);

      doc.moveTo(60, doc.y).lineTo(552, doc.y).strokeColor('#cccccc').stroke().moveDown(0.8);

      // ── Full contract text ────────────────────────────────────────────────
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#111111')
        .text(contract.fullText, { lineGap: 3 });

      doc.end();
    } catch (err) {
      console.error('[contracts.routes] GET /:contractId/pdf error:', err);
      // Can't use sendError once we've started streaming headers
      if (!res.headersSent) {
        sendError(res, 'Failed to generate PDF', 500);
      }
    }
  },
);

export default router;
