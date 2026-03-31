/**
 * src/routes/admin/reviews.routes.ts
 * Mounted at: /api/admin/reviews
 * Guards:     authenticate + requireAdmin (applied in admin/index.ts)
 *
 * GET  /                    — paginated reviews list with filters
 * GET  /anomalies           — suspicious review pattern detection
 * GET  /:reviewId           — full review detail
 * POST /:reviewId/approve   — clear is_flagged; review stays public
 * POST /:reviewId/remove    — soft-delete; email reviewer; recalculate contractor rating
 * POST /:reviewId/edit      — replace body; store original in review_edit_log
 *
 * NOTE: is_flagged and is_deleted are columns added via supabase_moderation.sql
 * and are NOT in the Prisma schema. All reads/writes on those columns use
 * prisma.$queryRaw / prisma.$executeRaw with Prisma.sql tagged templates.
 *
 * NOTE: contractorId query param in GET / is treated as the contractor's userId
 * (= Review.revieweeId when reviewerRole = INVESTOR).
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { writeAuditLog } from '../../services/admin/audit.service';
import { getServiceClient } from '../../lib/supabase';
import prisma from '../../lib/prisma';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const listSchema = z.object({
  status:       z.enum(['pending_moderation', 'approved', 'removed']).optional(),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(25),
  reviewerId:   z.string().optional(),
  contractorId: z.string().optional(), // contractor's userId (= revieweeId)
  minRating:    z.coerce.number().int().min(1).max(5).optional(),
  maxRating:    z.coerce.number().int().min(1).max(5).optional(),
  isFlagged:    z.enum(['true', 'false']).optional(),
  dateFrom:     z.string().optional(),
  dateTo:       z.string().optional(),
});

const removeSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
});

const editSchema = z.object({
  newContent: z.string().min(10, 'New content must be at least 10 characters').max(5000),
});

// ── Raw query row types ───────────────────────────────────────────────────────

interface ReviewListRow {
  id:                  string;
  title:               string;
  body:                string;
  rating:              number;
  reviewerRole:        string;
  reviewerId:          string;
  revieweeId:          string;
  jobId:               string;
  createdAt:           Date;
  is_flagged:          boolean;
  is_deleted:          boolean;
  reviewerName:        string;
  reviewerEmail:       string;
  contractorName:      string;
  contractorProfileId: string | null;
  total:               bigint;
}

interface ReviewRawFlags {
  id:         string;
  is_flagged: boolean;
  is_deleted: boolean;
}

interface RatingAgg {
  avg_rating: number | null;
  count:      bigint;
}

interface AnomalyRatingDropRow {
  revieweeId:          string;
  contractorProfileId: string;
  firstName:           string;
  lastName:            string;
  old_avg:             number;
  current_avg:         number;
}

interface AnomalyFakeRow {
  userId:              string;
  contractorProfileId: string;
  firstName:           string;
  lastName:            string;
  averageRating:       number;
  totalReviews:        number;
}

interface AnomalyDuplicateRow {
  reviewerId:       string;
  firstName:        string;
  lastName:         string;
  email:            string;
  body:             string;
  contractor_count: bigint;
}

// ── Email notification (fire-and-forget; no provider wired yet) ───────────────
// To wire a real provider, replace the console.log with a Resend/SendGrid call.

async function notifyReviewRemoved(
  reviewer: { email: string; firstName: string },
  reason:   string,
): Promise<void> {
  console.log(
    `[email] Review removed → ${reviewer.email}`,
    { to: reviewer.firstName, reason },
  );
}

// ── GET / ─────────────────────────────────────────────────────────────────────
//
// Paginated review list. Uses raw SQL so is_flagged / is_deleted columns
// (added via supabase_moderation.sql) are available for both filtering and output.
// Window function COUNT(*) OVER() avoids a separate COUNT query.

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  const {
    status, page, limit, reviewerId, contractorId,
    minRating, maxRating, isFlagged, dateFrom, dateTo,
  } = parsed.data;
  const offset = (page - 1) * limit;

  // Build WHERE conditions (parameterised via Prisma.sql tags — no injection risk)
  const wheres: Prisma.Sql[] = [];

  if (status === 'pending_moderation') {
    wheres.push(Prisma.sql`r.is_flagged = true AND r.is_deleted = false`);
  } else if (status === 'approved') {
    wheres.push(Prisma.sql`r.is_flagged = false AND r.is_deleted = false`);
  } else if (status === 'removed') {
    wheres.push(Prisma.sql`r.is_deleted = true`);
  }

  if (reviewerId)           wheres.push(Prisma.sql`r."reviewerId" = ${reviewerId}`);
  if (contractorId)         wheres.push(Prisma.sql`r."revieweeId" = ${contractorId}`);
  if (minRating !== undefined) wheres.push(Prisma.sql`r.rating >= ${minRating}`);
  if (maxRating !== undefined) wheres.push(Prisma.sql`r.rating <= ${maxRating}`);
  if (isFlagged !== undefined) {
    wheres.push(isFlagged === 'true' ? Prisma.sql`r.is_flagged = true` : Prisma.sql`r.is_flagged = false`);
  }
  if (dateFrom) wheres.push(Prisma.sql`r."createdAt" >= ${new Date(dateFrom)}`);
  if (dateTo)   wheres.push(Prisma.sql`r."createdAt" <= ${new Date(dateTo)}`);

  const whereExpr = wheres.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(wheres, ' AND ')}`
    : Prisma.sql``;

  try {
    const rows = await prisma.$queryRaw<ReviewListRow[]>(Prisma.sql`
      SELECT
        r.id,
        r.title,
        r.body,
        r.rating,
        r."reviewerRole",
        r."reviewerId",
        r."revieweeId",
        r."jobId",
        r."createdAt",
        r.is_flagged,
        r.is_deleted,
        (reviewer."firstName" || ' ' || reviewer."lastName") AS "reviewerName",
        reviewer.email                                        AS "reviewerEmail",
        (reviewee."firstName" || ' ' || reviewee."lastName") AS "contractorName",
        profile.id                                            AS "contractorProfileId",
        COUNT(*) OVER ()                                      AS total
      FROM        "Review"          r
      JOIN        "User"            reviewer ON reviewer.id = r."reviewerId"
      JOIN        "User"            reviewee ON reviewee.id = r."revieweeId"
      LEFT JOIN   "ContractorProfile" profile ON profile."userId" = r."revieweeId"
      ${whereExpr}
      ORDER BY r."createdAt" DESC
      LIMIT  ${limit}
      OFFSET ${offset}
    `);

    const total = rows.length > 0 ? Number(rows[0].total) : 0;

    sendSuccess(res, {
      data: rows.map((r) => ({
        id:                  r.id,
        title:               r.title,
        contentPreview:      r.body.length > 200 ? r.body.slice(0, 200) + '…' : r.body,
        body:                r.body,
        rating:              r.rating,
        reviewerRole:        r.reviewerRole,
        reviewerId:          r.reviewerId,
        reviewerName:        r.reviewerName,
        reviewerEmail:       r.reviewerEmail,
        contractorName:      r.contractorName,
        contractorProfileId: r.contractorProfileId,
        jobId:               r.jobId,
        isFlagged:           r.is_flagged,
        isDeleted:           r.is_deleted,
        createdAt:           r.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    });
  } catch (err) {
    console.error('[admin/reviews] GET / error:', err);
    sendError(res, 'Failed to fetch reviews', 500);
  }
});

// ── GET /anomalies ────────────────────────────────────────────────────────────
//
// Returns three classes of suspicious review patterns for admin investigation.
// Declared BEFORE /:reviewId to prevent route collision.
//
// 1. ratingDrops       — contractors whose current averageRating is >1 star below
//                        their pre-7-day historical average (new negative reviews dragged it down)
// 2. potentialFakeSeeding — contractors with a perfect 5.0 average and fewer than
//                        5 total reviews (possible astroturfing)
// 3. duplicateContent  — reviewers who submitted the identical review body on
//                        3 or more different contractors

router.get('/anomalies', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [ratingDrops, potentialFakes, duplicateContent] = await Promise.all([

      // 1. Rating dropped >1 star: avg(reviews older than 7d) vs current profile average
      prisma.$queryRaw<AnomalyRatingDropRow[]>(Prisma.sql`
        SELECT
          r."revieweeId",
          cp.id                  AS "contractorProfileId",
          u."firstName",
          u."lastName",
          AVG(r.rating)::float   AS old_avg,
          cp."averageRating"     AS current_avg
        FROM        "Review"          r
        JOIN        "ContractorProfile" cp ON cp."userId" = r."revieweeId"
        JOIN        "User"              u  ON u.id        = r."revieweeId"
        WHERE  r."createdAt" < NOW() - INTERVAL '7 days'
          AND  r.is_deleted = false
        GROUP  BY r."revieweeId", cp.id, cp."averageRating", u."firstName", u."lastName"
        HAVING cp."averageRating" < AVG(r.rating) - 1
      `),

      // 2. Potential fake seeding: perfect 5.0 with fewer than 5 reviews
      prisma.$queryRaw<AnomalyFakeRow[]>(Prisma.sql`
        SELECT
          cp."userId",
          cp.id             AS "contractorProfileId",
          u."firstName",
          u."lastName",
          cp."averageRating",
          cp."totalReviews"
        FROM   "ContractorProfile" cp
        JOIN   "User"              u  ON u.id = cp."userId"
        WHERE  cp."averageRating" = 5.0
          AND  cp."totalReviews"  > 0
          AND  cp."totalReviews"  < 5
      `),

      // 3. Duplicate content: same body on 3+ different contractors
      prisma.$queryRaw<AnomalyDuplicateRow[]>(Prisma.sql`
        SELECT
          r."reviewerId",
          u."firstName",
          u."lastName",
          u.email,
          r.body,
          COUNT(DISTINCT r."revieweeId") AS contractor_count
        FROM   "Review" r
        JOIN   "User"   u ON u.id = r."reviewerId"
        WHERE  r.is_deleted = false
        GROUP  BY r."reviewerId", r.body, u."firstName", u."lastName", u.email
        HAVING COUNT(DISTINCT r."revieweeId") >= 3
      `),
    ]);

    sendSuccess(res, {
      ratingDrops: ratingDrops.map((r) => ({
        type:                'rating_drop' as const,
        contractorId:        r.revieweeId,
        contractorProfileId: r.contractorProfileId,
        name:                `${r.firstName} ${r.lastName}`,
        oldAvg:              Number(r.old_avg),
        currentAvg:          Number(r.current_avg),
        drop:                parseFloat((Number(r.old_avg) - Number(r.current_avg)).toFixed(2)),
      })),
      potentialFakeSeeding: potentialFakes.map((r) => ({
        type:                'potential_fake_seeding' as const,
        contractorId:        r.userId,
        contractorProfileId: r.contractorProfileId,
        name:                `${r.firstName} ${r.lastName}`,
        averageRating:       Number(r.averageRating),
        totalReviews:        r.totalReviews,
      })),
      duplicateContent: duplicateContent.map((r) => ({
        type:            'duplicate_content' as const,
        reviewerId:      r.reviewerId,
        name:            `${r.firstName} ${r.lastName}`,
        email:           r.email,
        body:            r.body.length > 200 ? r.body.slice(0, 200) + '…' : r.body,
        contractorCount: Number(r.contractor_count),
      })),
    });
  } catch (err) {
    console.error('[admin/reviews] GET /anomalies error:', err);
    sendError(res, 'Failed to fetch review anomalies', 500);
  }
});

// ── GET /:reviewId ────────────────────────────────────────────────────────────
//
// Full review detail: review core data + raw flag columns + reviewer user profile
// + contractor profile (nullable; present only when reviewerRole = INVESTOR) +
// linked job + placeholder reports array (no review_reports table yet).

router.get('/:reviewId', async (req: Request, res: Response): Promise<void> => {
  const { reviewId } = req.params;

  try {
    const [review, flagRows] = await Promise.all([
      prisma.review.findUnique({
        where:  { id: reviewId },
        select: {
          id:           true,
          jobId:        true,
          reviewerId:   true,
          revieweeId:   true,
          rating:       true,
          title:        true,
          body:         true,
          reviewerRole: true,
          createdAt:    true,
          updatedAt:    true,
          reviewer: {
            select: {
              id:        true,
              firstName: true,
              lastName:  true,
              email:     true,
              role:      true,
              avatarUrl: true,
              createdAt: true,
            },
          },
          job: {
            select: {
              id:          true,
              title:       true,
              description: true,
              tradeType:   true,
              status:      true,
              city:        true,
              state:       true,
              createdAt:   true,
            },
          },
        },
      }),
      prisma.$queryRaw<ReviewRawFlags[]>(Prisma.sql`
        SELECT id, is_flagged, is_deleted FROM "Review" WHERE id = ${reviewId}
      `),
    ]);

    if (!review) { sendError(res, 'Review not found', 404); return; }

    // Contractor profile — present only when reviewerRole = INVESTOR (reviewee is the contractor)
    const contractorProfile = await prisma.contractorProfile.findUnique({
      where:  { userId: review.revieweeId },
      select: {
        id:                true,
        specialties:       true,
        averageRating:     true,
        totalReviews:      true,
        completedJobs:     true,
        yearsExperience:   true,
        isLicenseVerified: true,
        city:              true,
        state:             true,
        user: {
          select: {
            id:        true,
            firstName: true,
            lastName:  true,
            email:     true,
            avatarUrl: true,
          },
        },
      },
    });

    const flags = flagRows[0] ?? { is_flagged: false, is_deleted: false };

    sendSuccess(res, {
      review: {
        id:           review.id,
        jobId:        review.jobId,
        reviewerId:   review.reviewerId,
        revieweeId:   review.revieweeId,
        rating:       review.rating,
        title:        review.title,
        body:         review.body,
        reviewerRole: review.reviewerRole,
        createdAt:    review.createdAt,
        updatedAt:    review.updatedAt,
        isFlagged:    flags.is_flagged,
        isDeleted:    flags.is_deleted,
      },
      reviewer:          review.reviewer,
      job:               review.job,
      contractorProfile: contractorProfile ?? null,
      reports:           [], // TODO: query review_reports table once created
    });
  } catch (err) {
    console.error('[admin/reviews] GET /:reviewId error:', err);
    sendError(res, 'Failed to fetch review', 500);
  }
});

// ── POST /:reviewId/approve ───────────────────────────────────────────────────
//
// Clears is_flagged = false. Review stays public. Logs REVIEW_APPROVE.

router.post('/:reviewId/approve', async (req: Request, res: Response): Promise<void> => {
  const { reviewId } = req.params;
  const adminId = req.user!.userId;

  try {
    const affected = await prisma.$executeRaw(
      Prisma.sql`UPDATE "Review" SET is_flagged = false WHERE id = ${reviewId} AND is_deleted = false`,
    );
    if (affected === 0) { sendError(res, 'Review not found or already deleted', 404); return; }

    void writeAuditLog({
      adminId,
      action:     'REVIEW_APPROVE',
      targetType: 'review',
      targetId:   reviewId,
      ipAddress:  req.ip,
    });

    sendSuccess(res, { approved: true, reviewId });
  } catch (err) {
    console.error('[admin/reviews] POST /:reviewId/approve error:', err);
    sendError(res, 'Failed to approve review', 500);
  }
});

// ── POST /:reviewId/remove ────────────────────────────────────────────────────
//
// Soft-deletes the review (is_deleted = true).
// Recalculates the contractor's averageRating + totalReviews (excluding deleted reviews)
// when reviewerRole = INVESTOR (those reviews target the contractor's profile).
// Emails the reviewer (fire-and-forget, no provider wired yet).
// Logs REVIEW_REMOVE with reason in payload.

router.post('/:reviewId/remove', async (req: Request, res: Response): Promise<void> => {
  const { reviewId } = req.params;
  const adminId = req.user!.userId;

  const bodyParsed = removeSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    sendError(res, bodyParsed.error.issues[0]?.message ?? 'reason is required', 400);
    return;
  }
  const { reason } = bodyParsed.data;

  try {
    // 1. Fetch the review — need revieweeId + reviewerRole for recalc, reviewer for email
    const review = await prisma.review.findUnique({
      where:  { id: reviewId },
      select: {
        id:           true,
        revieweeId:   true,
        reviewerRole: true,
        reviewer: { select: { email: true, firstName: true } },
      },
    });
    if (!review) { sendError(res, 'Review not found', 404); return; }

    // 2. Soft-delete
    const affected = await prisma.$executeRaw(
      Prisma.sql`UPDATE "Review" SET is_deleted = true, is_flagged = false WHERE id = ${reviewId}`,
    );
    if (affected === 0) { sendError(res, 'Review not found', 404); return; }

    // 3. Recalculate contractor averageRating when the review targeted a contractor
    //    (i.e. reviewer was the investor). Uses raw SQL to exclude is_deleted rows.
    if (review.reviewerRole === 'INVESTOR') {
      const [agg] = await prisma.$queryRaw<RatingAgg[]>(Prisma.sql`
        SELECT AVG(rating)::float AS avg_rating, COUNT(*) AS count
        FROM   "Review"
        WHERE  "revieweeId" = ${review.revieweeId}
          AND  is_deleted = false
      `);
      await prisma.contractorProfile.updateMany({
        where: { userId: review.revieweeId },
        data: {
          averageRating: agg.avg_rating ?? 0,
          totalReviews:  Number(agg.count),
        },
      });
    }

    // 4. Email reviewer (fire-and-forget)
    notifyReviewRemoved(review.reviewer, reason).catch(console.error);

    // 5. Audit log (fire-and-forget)
    void writeAuditLog({
      adminId,
      action:     'REVIEW_REMOVE',
      targetType: 'review',
      targetId:   reviewId,
      payload:    { reason },
      ipAddress:  req.ip,
    });

    sendSuccess(res, { removed: true, reviewId });
  } catch (err) {
    console.error('[admin/reviews] POST /:reviewId/remove error:', err);
    sendError(res, 'Failed to remove review', 500);
  }
});

// ── POST /:reviewId/edit ──────────────────────────────────────────────────────
//
// Replaces review.body with newContent (rating unchanged).
// Stores the original body in review_edit_log via Supabase service client.
// Logs REVIEW_EDIT with truncated original + edited in payload.

router.post('/:reviewId/edit', async (req: Request, res: Response): Promise<void> => {
  const { reviewId } = req.params;
  const adminId = req.user!.userId;

  const bodyParsed = editSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    sendError(res, bodyParsed.error.issues[0]?.message ?? 'newContent is required', 400);
    return;
  }
  const { newContent } = bodyParsed.data;

  try {
    // 1. Fetch original body for the edit log
    const review = await prisma.review.findUnique({
      where:  { id: reviewId },
      select: { id: true, body: true },
    });
    if (!review) { sendError(res, 'Review not found', 404); return; }
    if (review.body === newContent) {
      sendError(res, 'New content is identical to the current body', 400);
      return;
    }

    const originalBody = review.body;

    // 2. Update body in Prisma (body is a first-class column in the schema)
    await prisma.review.update({
      where: { id: reviewId },
      data:  { body: newContent },
    });

    // 3. Log original → edited in review_edit_log (Supabase, service-role bypasses RLS)
    const supabase = getServiceClient();
    await supabase.from('review_edit_log').insert({
      review_id: reviewId,
      admin_id:  adminId,
      original:  originalBody,
      edited:    newContent,
    });

    // 4. Audit log (fire-and-forget; truncate to 200 chars to keep payload lean)
    void writeAuditLog({
      adminId,
      action:     'REVIEW_EDIT',
      targetType: 'review',
      targetId:   reviewId,
      payload: {
        original: originalBody.length > 200 ? originalBody.slice(0, 200) + '…' : originalBody,
        edited:   newContent.length  > 200 ? newContent.slice(0, 200)  + '…' : newContent,
      },
      ipAddress: req.ip,
    });

    sendSuccess(res, { edited: true, reviewId });
  } catch (err) {
    console.error('[admin/reviews] POST /:reviewId/edit error:', err);
    sendError(res, 'Failed to edit review', 500);
  }
});

// ── POST /:reviewId/flag ──────────────────────────────────────────────────────
//
// Sets is_flagged = true so the review surfaces in the moderation queue.
// Useful when an admin spots a suspicious review in the All Reviews table.
// Logs REVIEW_FLAG.

router.post('/:reviewId/flag', async (req: Request, res: Response): Promise<void> => {
  const { reviewId } = req.params;
  const adminId = req.user!.userId;

  try {
    const affected = await prisma.$executeRaw(
      Prisma.sql`UPDATE "Review" SET is_flagged = true WHERE id = ${reviewId} AND is_deleted = false`,
    );
    if (affected === 0) { sendError(res, 'Review not found or already deleted', 404); return; }

    void writeAuditLog({
      adminId,
      action:     'REVIEW_FLAG',
      targetType: 'review',
      targetId:   reviewId,
      ipAddress:  req.ip,
    });

    sendSuccess(res, { flagged: true, reviewId });
  } catch (err) {
    console.error('[admin/reviews] POST /:reviewId/flag error:', err);
    sendError(res, 'Failed to flag review', 500);
  }
});

export default router;
