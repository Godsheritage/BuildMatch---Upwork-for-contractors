/**
 * src/routes/admin/analytics.routes.ts
 * Mounted at: /api/admin/analytics
 * Guards: authenticate + requireAdmin (applied in admin/index.ts)
 *
 * All endpoints cache responses for 6 hours — analytics queries are
 * expensive and results need not be real-time.
 *
 * GET /user-growth         — signup trend by role, grouped by day/week/month
 * GET /job-funnel          — job lifecycle conversion metrics
 * GET /revenue-over-time   — GMV + platform revenue by month
 * GET /geographic          — state-level distribution + supply-gap detection
 * GET /retention           — repeat-usage and engagement metrics
 * GET /search-gaps         — top 20 contractor searches that returned 0 results
 *
 * NOTE: period / groupBy strings are Zod-validated before use in Prisma.raw() —
 * the raw() calls here are safe because all injected strings come from a
 * closed enum, never from free-form user input.
 */

import { Router }       from 'express';
import type { Request, Response } from 'express';
import { z }            from 'zod';
import { Prisma }       from '@prisma/client';
import { sendSuccess, sendError } from '../../utils/response.utils';
import prisma           from '../../lib/prisma';

const router = Router();

// ── 6-hour in-memory cache ────────────────────────────────────────────────────

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const _cache = new Map<string, { data: unknown; expiresAt: number }>();

function getCached<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry.data as T;
}

function setCached(key: string, data: unknown): void {
  _cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Validated period → PostgreSQL interval strings ────────────────────────────
// Only these values are ever passed to Prisma.raw() — no free-form input.

const PERIOD_INTERVAL: Record<string, string> = {
  '7d':  '7 days',
  '30d': '30 days',
  '90d': '90 days',
  '12m': '12 months',
  '24m': '24 months',
};

const STEP_INTERVAL: Record<string, string> = {
  'day':   '1 day',
  'week':  '1 week',
  'month': '1 month',
};

// ── Label formatter ───────────────────────────────────────────────────────────

function fmtBucket(bucket: Date, groupBy: string): string {
  if (groupBy === 'month') {
    return new Date(bucket).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  if (groupBy === 'week') {
    return `Week of ${new Date(bucket).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return new Date(bucket).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const growthSchema = z.object({
  period:  z.enum(['7d', '30d', '90d', '12m']).default('30d'),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

const revenueSchema = z.object({
  period: z.enum(['12m', '24m']).default('12m'),
});

// ── Raw row types ─────────────────────────────────────────────────────────────

interface GrowthRow    { bucket: Date; investors: number; contractors: number; }
interface RevenueRow   { month: Date;  gmv: number | null; revenue: number | null; jobs_completed: number | null; }
interface InvestorStateRow   { state: string; investor_count: number; }
interface ContractorStateRow { state: string; contractor_count: number; }
interface JobStateRow        { state: string; job_count: number; gmv: number | null; }
interface AvgAwardRow  { avg_days: number | null; }
interface FunnelRow {
  posted: number; received_bids: number; awarded: number;
  in_progress: number; completed: number; total_bids: number;
}
interface RetentionRow {
  repeat_investors: number; total_investors: number;
  active_contractors: number; avg_jobs: number | null; avg_bids: number | null;
}
interface SearchGapRow { query: string; count: number; last_searched: Date; }

// ── GET /user-growth ──────────────────────────────────────────────────────────
//
// Returns parallel arrays (labels, investors, contractors, total) suitable for
// line / bar chart rendering.  Fills buckets with 0 even when no signups occurred.

router.get('/user-growth', async (req: Request, res: Response): Promise<void> => {
  const parsed = growthSchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  const { period, groupBy } = parsed.data;
  const cacheKey = `user-growth:${period}:${groupBy}`;
  const cached   = getCached<object>(cacheKey);
  if (cached) { sendSuccess(res, cached); return; }

  try {
    // Both strings come from Zod enums — safe for Prisma.raw
    const intervalSql = Prisma.raw(`INTERVAL '${PERIOD_INTERVAL[period]}'`);
    const stepSql     = Prisma.raw(`INTERVAL '${STEP_INTERVAL[groupBy]}'`);

    const rows = await prisma.$queryRaw<GrowthRow[]>(Prisma.sql`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc(${groupBy}, NOW() - ${intervalSql}),
          date_trunc(${groupBy}, NOW()),
          ${stepSql}
        ) AS bucket
      ),
      signups AS (
        SELECT
          date_trunc(${groupBy}, "createdAt") AS bucket,
          role,
          COUNT(*)::int AS count
        FROM   "User"
        WHERE  "createdAt" >= NOW() - ${intervalSql}
          AND  role IN ('INVESTOR', 'CONTRACTOR')
        GROUP  BY 1, role
      )
      SELECT
        b.bucket,
        COALESCE(MAX(CASE WHEN s.role = 'INVESTOR'   THEN s.count END), 0) AS investors,
        COALESCE(MAX(CASE WHEN s.role = 'CONTRACTOR' THEN s.count END), 0) AS contractors
      FROM   buckets b
      LEFT   JOIN signups s ON s.bucket = b.bucket
      GROUP  BY b.bucket
      ORDER  BY b.bucket
    `);

    const labels      = rows.map(r => fmtBucket(r.bucket, groupBy));
    const investors   = rows.map(r => Number(r.investors));
    const contractors = rows.map(r => Number(r.contractors));
    const total       = rows.map((_, i) => investors[i] + contractors[i]);

    const result = { labels, investors, contractors, total };
    setCached(cacheKey, result);
    sendSuccess(res, result);
  } catch (err) {
    console.error('[admin/analytics] GET /user-growth error:', err);
    sendError(res, 'Failed to fetch user growth data', 500);
  }
});

// ── GET /job-funnel ───────────────────────────────────────────────────────────
//
// Single-pass funnel showing how many jobs move through each lifecycle stage,
// plus derived rates and averages.

router.get('/job-funnel', async (_req: Request, res: Response): Promise<void> => {
  const cacheKey = 'job-funnel';
  const cached   = getCached<object>(cacheKey);
  if (cached) { sendSuccess(res, cached); return; }

  try {
    const [funnelRows, avgAwardRows] = await Promise.all([

      prisma.$queryRaw<FunnelRow[]>(Prisma.sql`
        SELECT
          COUNT(DISTINCT j.id)::int                                                               AS posted,
          COUNT(DISTINCT b."jobId")::int                                                          AS received_bids,
          COUNT(DISTINCT CASE WHEN j.status IN ('AWARDED','IN_PROGRESS','COMPLETED')
                              THEN j.id END)::int                                                 AS awarded,
          COUNT(DISTINCT CASE WHEN j.status = 'IN_PROGRESS' THEN j.id END)::int                  AS in_progress,
          COUNT(DISTINCT CASE WHEN j.status = 'COMPLETED'   THEN j.id END)::int                  AS completed,
          COUNT(b.id)::int                                                                        AS total_bids
        FROM   "Job" j
        LEFT   JOIN "Bid" b ON b."jobId" = j.id
      `),

      // Average days from job creation to bid acceptance
      prisma.$queryRaw<AvgAwardRow[]>(Prisma.sql`
        SELECT COALESCE(
          AVG(EXTRACT(EPOCH FROM (b."createdAt" - j."createdAt")) / 86400.0),
          0
        )::float AS avg_days
        FROM   "Job" j
        JOIN   "Bid" b ON b."jobId" = j.id AND b.status = 'ACCEPTED'
      `),
    ]);

    const f       = funnelRows[0];
    const posted  = Number(f?.posted    ?? 0);
    const completed = Number(f?.completed ?? 0);
    const totalBids = Number(f?.total_bids ?? 0);

    const result = {
      posted,
      received_bids:          Number(f?.received_bids ?? 0),
      awarded:                Number(f?.awarded       ?? 0),
      in_progress:            Number(f?.in_progress   ?? 0),
      completed,
      completion_rate:        posted > 0
        ? parseFloat(((completed / posted) * 100).toFixed(1))
        : 0,
      avg_bids_per_job:       posted > 0
        ? parseFloat((totalBids / posted).toFixed(1))
        : 0,
      avg_time_to_award_days: parseFloat(
        ((avgAwardRows[0]?.avg_days ?? 0) as number).toFixed(1),
      ),
    };

    setCached(cacheKey, result);
    sendSuccess(res, result);
  } catch (err) {
    console.error('[admin/analytics] GET /job-funnel error:', err);
    sendError(res, 'Failed to fetch job funnel data', 500);
  }
});

// ── GET /revenue-over-time ────────────────────────────────────────────────────
//
// Monthly GMV (total escrow amount), platform fee revenue, and completed job
// counts for the requested look-back period.

router.get('/revenue-over-time', async (req: Request, res: Response): Promise<void> => {
  const parsed = revenueSchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  const { period } = parsed.data;
  const cacheKey   = `revenue-over-time:${period}`;
  const cached     = getCached<object>(cacheKey);
  if (cached) { sendSuccess(res, cached); return; }

  try {
    const intervalSql = Prisma.raw(`INTERVAL '${PERIOD_INTERVAL[period]}'`);

    const rows = await prisma.$queryRaw<RevenueRow[]>(Prisma.sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', NOW() - ${intervalSql}),
          date_trunc('month', NOW()),
          INTERVAL '1 month'
        ) AS month
      ),
      escrow_rev AS (
        SELECT
          date_trunc('month', ep."createdAt") AS month,
          SUM(ep."totalAmount")::float         AS gmv,
          SUM(ep."platformFeeAmount")::float   AS revenue
        FROM   "EscrowPayment" ep
        WHERE  ep."createdAt" >= NOW() - ${intervalSql}
        GROUP  BY 1
      ),
      completions AS (
        SELECT
          date_trunc('month', j."updatedAt") AS month,
          COUNT(*)::int                       AS jobs_completed
        FROM   "Job" j
        WHERE  j.status = 'COMPLETED'
          AND  j."updatedAt" >= NOW() - ${intervalSql}
        GROUP  BY 1
      )
      SELECT
        m.month,
        COALESCE(r.gmv,            0) AS gmv,
        COALESCE(r.revenue,        0) AS revenue,
        COALESCE(c.jobs_completed, 0) AS jobs_completed
      FROM   months m
      LEFT   JOIN escrow_rev r   ON r.month = m.month
      LEFT   JOIN completions c  ON c.month = m.month
      ORDER  BY m.month
    `);

    const labels         = rows.map(r => fmtBucket(r.month, 'month'));
    const gmv            = rows.map(r => parseFloat(((r.gmv ?? 0) as number).toFixed(2)));
    const revenue        = rows.map(r => parseFloat(((r.revenue ?? 0) as number).toFixed(2)));
    const jobs_completed = rows.map(r => Number(r.jobs_completed ?? 0));

    const result = { labels, gmv, revenue, jobs_completed };
    setCached(cacheKey, result);
    sendSuccess(res, result);
  } catch (err) {
    console.error('[admin/analytics] GET /revenue-over-time error:', err);
    sendError(res, 'Failed to fetch revenue data', 500);
  }
});

// ── GET /geographic ───────────────────────────────────────────────────────────
//
// State-level breakdown of investor users, contractor profiles, job counts, and
// GMV.  Also returns a `gaps` array: states where investor/job demand clearly
// outpaces contractor supply (good expansion opportunities).

router.get('/geographic', async (_req: Request, res: Response): Promise<void> => {
  const cacheKey = 'geographic';
  const cached   = getCached<object>(cacheKey);
  if (cached) { sendSuccess(res, cached); return; }

  try {
    // Run three independent queries in parallel
    const [investorRows, contractorRows, jobRows] = await Promise.all([

      // Investors are stored with state on User
      prisma.$queryRaw<InvestorStateRow[]>(Prisma.sql`
        SELECT state, COUNT(*)::int AS investor_count
        FROM   "User"
        WHERE  role = 'INVESTOR'
          AND  state IS NOT NULL AND state != ''
        GROUP  BY state
      `),

      // Contractors store state on ContractorProfile
      prisma.$queryRaw<ContractorStateRow[]>(Prisma.sql`
        SELECT state, COUNT(*)::int AS contractor_count
        FROM   "ContractorProfile"
        WHERE  state IS NOT NULL AND state != ''
        GROUP  BY state
      `),

      // Jobs + GMV (via escrow) per state
      prisma.$queryRaw<JobStateRow[]>(Prisma.sql`
        SELECT
          j.state,
          COUNT(j.id)::int                           AS job_count,
          COALESCE(SUM(ep."totalAmount"), 0)::float  AS gmv
        FROM   "Job" j
        LEFT   JOIN "EscrowPayment" ep ON ep."jobId" = j.id
        WHERE  j.state IS NOT NULL AND j.state != ''
        GROUP  BY j.state
      `),
    ]);

    // Merge by state into a single map
    type StateEntry = {
      state: string; investor_count: number; contractor_count: number;
      job_count: number; gmv: number;
    };
    const stateMap = new Map<string, StateEntry>();

    for (const r of investorRows) {
      stateMap.set(r.state, {
        state: r.state, investor_count: Number(r.investor_count),
        contractor_count: 0, job_count: 0, gmv: 0,
      });
    }
    for (const r of contractorRows) {
      const e = stateMap.get(r.state) ?? {
        state: r.state, investor_count: 0, contractor_count: 0, job_count: 0, gmv: 0,
      };
      e.contractor_count = Number(r.contractor_count);
      stateMap.set(r.state, e);
    }
    for (const r of jobRows) {
      const e = stateMap.get(r.state) ?? {
        state: r.state, investor_count: 0, contractor_count: 0, job_count: 0, gmv: 0,
      };
      e.job_count = Number(r.job_count);
      e.gmv       = Number(r.gmv ?? 0);
      stateMap.set(r.state, e);
    }

    // Sort by total activity desc
    const states = Array.from(stateMap.values()).sort(
      (a, b) =>
        (b.investor_count + b.contractor_count + b.job_count) -
        (a.investor_count + a.contractor_count + a.job_count),
    );

    // Supply gap: meaningful investor/job demand but contractor supply < demand
    // gap_score = investor_count / max(contractor_count, 1)
    const gaps = states
      .filter(
        s => (s.investor_count + s.job_count) >= 5 && s.contractor_count < s.investor_count,
      )
      .map(s => ({
        state:            s.state,
        investor_count:   s.investor_count,
        contractor_count: s.contractor_count,
        job_count:        s.job_count,
        gap_score:        parseFloat((s.investor_count / Math.max(s.contractor_count, 1)).toFixed(1)),
      }))
      .sort((a, b) => b.gap_score - a.gap_score);

    const result = { states, gaps };
    setCached(cacheKey, result);
    sendSuccess(res, result);
  } catch (err) {
    console.error('[admin/analytics] GET /geographic error:', err);
    sendError(res, 'Failed to fetch geographic data', 500);
  }
});

// ── GET /retention ────────────────────────────────────────────────────────────
//
// Composite retention metrics derived from job and bid activity.

router.get('/retention', async (_req: Request, res: Response): Promise<void> => {
  const cacheKey = 'retention';
  const cached   = getCached<object>(cacheKey);
  if (cached) { sendSuccess(res, cached); return; }

  try {
    const [row] = await prisma.$queryRaw<RetentionRow[]>(Prisma.sql`
      SELECT
        -- investors who posted ≥2 jobs
        ( SELECT COUNT(DISTINCT "investorId")::int
          FROM   "Job"
          GROUP  BY "investorId"
          HAVING COUNT(*) >= 2
        )::int                                                            AS repeat_investors,

        -- all investors who posted at least 1 job
        ( SELECT COUNT(DISTINCT "investorId")::int FROM "Job" )::int     AS total_investors,

        -- contractors who submitted a bid in the last 90 days
        ( SELECT COUNT(DISTINCT "contractorId")::int
          FROM   "Bid"
          WHERE  "createdAt" >= NOW() - INTERVAL '90 days'
        )::int                                                            AS active_contractors,

        -- average jobs per investor (across investors who have ever posted)
        ( SELECT COALESCE(AVG(job_count)::float, 0)
          FROM ( SELECT "investorId", COUNT(*) AS job_count
                 FROM   "Job"
                 GROUP  BY "investorId" ) sub
        )                                                                 AS avg_jobs,

        -- average bids per contractor (across contractors who have ever bid)
        ( SELECT COALESCE(AVG(bid_count)::float, 0)
          FROM ( SELECT "contractorId", COUNT(*) AS bid_count
                 FROM   "Bid"
                 GROUP  BY "contractorId" ) sub
        )                                                                 AS avg_bids
    `);

    const repeatInvestors = Number(row?.repeat_investors ?? 0);
    const totalInvestors  = Number(row?.total_investors  ?? 0);

    const result = {
      investor_repeat_rate:    totalInvestors > 0
        ? parseFloat(((repeatInvestors / totalInvestors) * 100).toFixed(1))
        : 0,
      contractor_active_90d:  Number(row?.active_contractors ?? 0),
      avg_jobs_per_investor:  parseFloat(((row?.avg_jobs ?? 0) as number).toFixed(1)),
      avg_bids_per_contractor: parseFloat(((row?.avg_bids ?? 0) as number).toFixed(1)),
    };

    setCached(cacheKey, result);
    sendSuccess(res, result);
  } catch (err) {
    console.error('[admin/analytics] GET /retention error:', err);
    sendError(res, 'Failed to fetch retention data', 500);
  }
});

// ── GET /search-gaps ──────────────────────────────────────────────────────────
//
// Top 20 contractor-search queries that matched 0 contractors in the last 30 days.
// Reads from the `search_log` table created via supabase_search_log.sql.
// Used to identify unmet service demand and inform contractor acquisition.

router.get('/search-gaps', async (_req: Request, res: Response): Promise<void> => {
  const cacheKey = 'search-gaps';
  const cached   = getCached<object>(cacheKey);
  if (cached) { sendSuccess(res, cached); return; }

  try {
    const rows = await prisma.$queryRaw<SearchGapRow[]>(Prisma.sql`
      SELECT
        LOWER(TRIM(query))       AS query,
        COUNT(*)::int            AS count,
        MAX(created_at)          AS last_searched
      FROM   search_log
      WHERE  result_count = 0
        AND  created_at >= NOW() - INTERVAL '30 days'
        AND  query IS NOT NULL
        AND  TRIM(query) != ''
      GROUP  BY LOWER(TRIM(query))
      ORDER  BY count DESC
      LIMIT  20
    `);

    const result = {
      queries: rows.map(r => ({
        query:        r.query,
        count:        Number(r.count),
        last_searched: new Date(r.last_searched).toISOString(),
      })),
      period:  'last_30_days',
      total_zero_result_searches: rows.reduce((n, r) => n + Number(r.count), 0),
    };

    setCached(cacheKey, result);
    sendSuccess(res, result);
  } catch (err) {
    console.error('[admin/analytics] GET /search-gaps error:', err);
    sendError(res, 'Failed to fetch search gap data', 500);
  }
});

export default router;
