/**
 * src/routes/admin/testimonials.routes.ts
 * Mounted at: /api/admin/testimonials
 * Guards:     authenticate + requireAdmin (applied in admin/index.ts)
 *
 * GET  /               — paginated list of all testimonials (filter: approved, contractorId)
 * GET  /pending-count  — count of testimonials awaiting approval
 * POST /:id/approve    — approve a testimonial (makes it public)
 * POST /:id/reject     — reject and permanently delete a testimonial (requires reason)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { writeAuditLog } from '../../services/admin/audit.service';
import prisma from '../../lib/prisma';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const listSchema = z.object({
  approved:     z.enum(['true', 'false', 'all']).default('all'),
  contractorId: z.string().optional(), // contractor's userId
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(25),
});

const rejectSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
});

// ── GET /pending-count ────────────────────────────────────────────────────────
// Must be declared before /:id to prevent route collision.

router.get('/pending-count', async (_req: Request, res: Response): Promise<void> => {
  try {
    const count = await prisma.testimonial.count({ where: { approved: false } });
    sendSuccess(res, { count });
  } catch (err) {
    console.error('[admin/testimonials] GET /pending-count error:', err);
    sendError(res, 'Failed to fetch pending count', 500);
  }
});

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  const { approved, contractorId, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  // Build the where filter
  const where: {
    approved?: boolean;
    contractorProfile?: { userId: string };
  } = {};

  if (approved === 'true')  where.approved = true;
  if (approved === 'false') where.approved = false;
  if (contractorId)         where.contractorProfile = { userId: contractorId };

  try {
    const [testimonials, total] = await Promise.all([
      prisma.testimonial.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    offset,
        take:    limit,
        include: {
          contractorProfile: {
            select: {
              id:   true,
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      }),
      prisma.testimonial.count({ where }),
    ]);

    sendSuccess(res, {
      data: testimonials.map((t) => ({
        id:             t.id,
        authorName:     t.authorName,
        authorEmail:    t.authorEmail,
        body:           t.body,
        approved:       t.approved,
        approvedAt:     t.approvedAt,
        createdAt:      t.createdAt,
        contractorProfileId: t.contractorProfileId,
        contractorName: `${t.contractorProfile.user.firstName} ${t.contractorProfile.user.lastName}`,
        contractorUserId: t.contractorProfile.user.id,
        contractorEmail:  t.contractorProfile.user.email,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    });
  } catch (err) {
    console.error('[admin/testimonials] GET / error:', err);
    sendError(res, 'Failed to fetch testimonials', 500);
  }
});

// ── POST /:id/approve ─────────────────────────────────────────────────────────

router.post('/:id/approve', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const adminId = req.user!.userId;

  try {
    const testimonial = await prisma.testimonial.findUnique({ where: { id } });
    if (!testimonial) { sendError(res, 'Testimonial not found', 404); return; }
    if (testimonial.approved) { sendError(res, 'Testimonial is already approved', 409); return; }

    await prisma.testimonial.update({
      where: { id },
      data:  { approved: true, approvedAt: new Date() },
    });

    void writeAuditLog({
      adminId,
      action:     'TESTIMONIAL_APPROVE',
      targetType: 'testimonial',
      targetId:   id,
      ipAddress:  req.ip,
    });

    sendSuccess(res, { approved: true, id });
  } catch (err) {
    console.error('[admin/testimonials] POST /:id/approve error:', err);
    sendError(res, 'Failed to approve testimonial', 500);
  }
});

// ── POST /:id/reject ──────────────────────────────────────────────────────────

router.post('/:id/reject', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const adminId = req.user!.userId;

  const bodyParsed = rejectSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    sendError(res, bodyParsed.error.issues[0]?.message ?? 'reason is required', 400);
    return;
  }
  const { reason } = bodyParsed.data;

  try {
    const testimonial = await prisma.testimonial.findUnique({ where: { id } });
    if (!testimonial) { sendError(res, 'Testimonial not found', 404); return; }

    await prisma.testimonial.delete({ where: { id } });

    void writeAuditLog({
      adminId,
      action:     'TESTIMONIAL_REJECT',
      targetType: 'testimonial',
      targetId:   id,
      payload:    { reason },
      ipAddress:  req.ip,
    });

    sendSuccess(res, { rejected: true, id });
  } catch (err) {
    console.error('[admin/testimonials] POST /:id/reject error:', err);
    sendError(res, 'Failed to reject testimonial', 500);
  }
});

export default router;
