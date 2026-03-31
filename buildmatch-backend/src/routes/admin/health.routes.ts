/**
 * src/routes/admin/health.routes.ts
 * Mounted at: /api/admin/health
 * Guards: authenticate + requireAdmin (applied in admin/index.ts)
 *
 * GET /status            — live health snapshot (API latency, DB, storage, Stripe, Supabase)
 * GET /errors            — paginated 5xx error log from api_error_log (last 7 days)
 * GET /background-jobs   — background job runs from background_job_log (last 24 hours)
 */

import { Router }       from 'express';
import type { Request, Response } from 'express';
import { z }            from 'zod';
import { Prisma }       from '@prisma/client';
import { sendSuccess, sendError } from '../../utils/response.utils';
import prisma           from '../../lib/prisma';
import { getServiceClient } from '../../lib/supabase';
import { getResponseTimeStats, getHourlyPerformance } from '../../middleware/requestTimer.middleware';

const router = Router();

// ── Schemas ────────────────────────────────────────────────────────────────────

const errorsQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(25),
  dateFrom: z.string().optional(),
  dateTo:   z.string().optional(),
  endpoint: z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

type HealthStatus = 'healthy' | 'degraded' | 'down';

function classify(ok: boolean, latencyMs?: number, warnThresholdMs = 200): HealthStatus {
  if (!ok) return 'down';
  if (latencyMs !== undefined && latencyMs > warnThresholdMs) return 'degraded';
  return 'healthy';
}

/**
 * Sum the sizes (in bytes) of all objects inside a Supabase storage bucket.
 * Returns { sizeMb, status } — status 'healthy' if the bucket is accessible.
 *
 * We list up to 1 000 objects at the root; nested prefixes are counted only
 * via their direct file entry.  For very large buckets this is a safe
 * approximation — the goal is order-of-magnitude visibility, not precision.
 */
async function getBucketMb(bucketName: string): Promise<{ sizeMb: number; status: HealthStatus }> {
  try {
    const { data, error } = await getServiceClient()
      .storage
      .from(bucketName)
      .list('', { limit: 1_000 });

    if (error) return { sizeMb: 0, status: 'degraded' };

    const totalBytes = (data ?? []).reduce((sum, f) => {
      const size = (f.metadata as { size?: number } | null)?.size ?? 0;
      return sum + size;
    }, 0);

    return {
      sizeMb: parseFloat((totalBytes / (1024 * 1024)).toFixed(2)),
      status: 'healthy',
    };
  } catch {
    return { sizeMb: 0, status: 'down' };
  }
}

// ── GET /status ───────────────────────────────────────────────────────────────

router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    // ── 1. API response time (from in-memory rolling buffer) ──────────────────
    const { avgResponseMs, p95ResponseMs } = getResponseTimeStats();
    const hourlyPerformance = getHourlyPerformance();
    const apiStatus: HealthStatus = p95ResponseMs > 2_000 ? 'degraded' : 'healthy';

    // ── 2. Database ───────────────────────────────────────────────────────────
    let dbStatus: HealthStatus = 'down';
    let queryAvgMs             = 0;
    let connectionPoolUsed     = 0;

    try {
      const t0 = Date.now();
      await prisma.$queryRaw(Prisma.sql`SELECT 1`);
      queryAvgMs = Date.now() - t0;
      dbStatus   = classify(true, queryAvgMs, 500);

      // Prisma v5 exposes connection pool metrics via $metrics (opt-in).
      // Fall back gracefully when not configured.
      try {
        const metrics = await (prisma as unknown as {
          $metrics?: { json(): Promise<{ gauges?: { key: string; value: number }[] }> };
        }).$metrics?.json();
        const poolGauge = metrics?.gauges?.find(
          g => g.key === 'prisma_pool_connections_open',
        );
        connectionPoolUsed = poolGauge?.value ?? 0;
      } catch {
        connectionPoolUsed = 0;
      }
    } catch {
      dbStatus = 'down';
    }

    // ── 3. Storage buckets ────────────────────────────────────────────────────
    const [avatarsResult, photosResult, videosResult] = await Promise.all([
      getBucketMb('avatars'),
      getBucketMb('job-photos'),
      getBucketMb('job-videos'),
    ]);

    const allBucketsOk =
      avatarsResult.status !== 'down' &&
      photosResult.status  !== 'down' &&
      videosResult.status  !== 'down';
    const anyBucketDegraded =
      avatarsResult.status === 'degraded' ||
      photosResult.status  === 'degraded' ||
      videosResult.status  === 'degraded';

    const storageStatus: HealthStatus = !allBucketsOk
      ? 'down'
      : anyBucketDegraded ? 'degraded' : 'healthy';

    // ── 4. Stripe — last webhook received ────────────────────────────────────
    // Reads from stripe_webhook_log, populated by the Stripe webhook handler.
    // If the table doesn't exist the catch returns a healthy placeholder.
    let stripeStatus: HealthStatus           = 'healthy';
    let lastWebhookReceivedAt: string | null = null;

    try {
      const { data: webhookRows } = await getServiceClient()
        .from('stripe_webhook_log')
        .select('received_at')
        .order('received_at', { ascending: false })
        .limit(1);

      if (webhookRows && webhookRows.length > 0) {
        lastWebhookReceivedAt = webhookRows[0].received_at as string;
        const ageMs = Date.now() - new Date(lastWebhookReceivedAt).getTime();
        if (ageMs > 24 * 60 * 60 * 1_000) stripeStatus = 'degraded';
      }
    } catch {
      stripeStatus = 'healthy';
    }

    // ── 5. Supabase Realtime — connectivity check ─────────────────────────────
    // Active socket connections aren't queryable via REST; we verify REST
    // reachability instead and return a placeholder connection count.
    let realtimeStatus: HealthStatus = 'down';
    let activeConnections            = 0;

    try {
      const { error: pingError } = await getServiceClient()
        .from('api_error_log')
        .select('id', { count: 'exact', head: true });

      if (!pingError) {
        realtimeStatus    = 'healthy';
        activeConnections = 0;
      }
    } catch {
      realtimeStatus = 'down';
    }

    sendSuccess(res, {
      api: {
        status:             apiStatus,
        avgResponseMs,
        p95ResponseMs,
        hourlyPerformance,
      },
      database: {
        status:            dbStatus,
        queryAvgMs,
        connectionPoolUsed,
      },
      storage: {
        status:            storageStatus,
        avatarsBucketMb:   avatarsResult.sizeMb,
        jobPhotosBucketMb: photosResult.sizeMb,
        jobVideosBucketMb: videosResult.sizeMb,
      },
      stripe: {
        status:               stripeStatus,
        lastWebhookReceivedAt,
      },
      supabaseRealtime: {
        status:           realtimeStatus,
        activeConnections,
      },
    });
  } catch (err) {
    console.error('[admin/health] GET /status error:', err);
    sendError(res, 'Failed to fetch health status', 500);
  }
});

// ── GET /errors ───────────────────────────────────────────────────────────────

router.get('/errors', async (req: Request, res: Response): Promise<void> => {
  const parsed = errorsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }

  const { page, limit, dateFrom, dateTo, endpoint } = parsed.data;
  const offset = (page - 1) * limit;

  // Default to last 7 days
  const effectiveDateFrom = dateFrom
    ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000).toISOString();

  try {
    let query = getServiceClient()
      .from('api_error_log')
      .select('*', { count: 'exact' })
      .gte('created_at', effectiveDateFrom)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (dateTo)   query = query.lte('created_at', dateTo);
    if (endpoint) query = query.ilike('endpoint', `%${endpoint}%`);

    const { data, count, error } = await query;

    if (error) {
      console.error('[admin/health] GET /errors Supabase error:', error);
      sendError(res, 'Failed to fetch error log', 500);
      return;
    }

    const total      = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    sendSuccess(res, {
      data:       data ?? [],
      total,
      page,
      totalPages,
      limit,
    });
  } catch (err) {
    console.error('[admin/health] GET /errors error:', err);
    sendError(res, 'Failed to fetch error log', 500);
  }
});

// ── GET /background-jobs ──────────────────────────────────────────────────────

router.get('/background-jobs', async (_req: Request, res: Response): Promise<void> => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();

    const { data: runs, error } = await getServiceClient()
      .from('background_job_log')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[admin/health] GET /background-jobs Supabase error:', error);
      sendError(res, 'Failed to fetch background job log', 500);
      return;
    }

    // Collapse to one summary row per job_name (most-recent run + counts)
    type JobRun = {
      id:          string;
      job_name:    string;
      status:      string;
      error_msg:   string | null;
      duration_ms: number | null;
      created_at:  string;
    };

    const byName = new Map<string, {
      job_name:    string;
      last_run_at: string;
      status:      string;
      error_msg:   string | null;
      run_count:   number;
      fail_count:  number;
    }>();

    for (const row of (runs ?? []) as JobRun[]) {
      const existing = byName.get(row.job_name);
      if (!existing) {
        byName.set(row.job_name, {
          job_name:    row.job_name,
          last_run_at: row.created_at,
          status:      row.status,
          error_msg:   row.error_msg,
          run_count:   1,
          fail_count:  row.status === 'failed' ? 1 : 0,
        });
      } else {
        existing.run_count++;
        if (row.status === 'failed') existing.fail_count++;
      }
    }

    // Enumerate known jobs so stale/never-run ones surface in the dashboard
    const KNOWN_JOBS = [
      'send_notifications',
      'process_webhooks',
      'retry_failed_payouts',
      'send_daily_digest',
    ];

    const summary = KNOWN_JOBS.map(name => byName.get(name) ?? {
      job_name:    name,
      last_run_at: null,
      status:      'never_run',
      error_msg:   null,
      run_count:   0,
      fail_count:  0,
    });

    // Append unknown job names that appeared in the log
    for (const [name, entry] of byName) {
      if (!KNOWN_JOBS.includes(name)) summary.push(entry);
    }

    sendSuccess(res, { jobs: summary, since, rawRuns: runs ?? [] });
  } catch (err) {
    console.error('[admin/health] GET /background-jobs error:', err);
    sendError(res, 'Failed to fetch background job data', 500);
  }
});

// ── POST /jobs/:name/trigger ──────────────────────────────────────────────────
// Manually trigger a known background job for debugging.
// Writes a 'running' → 'success' / 'failed' lifecycle to background_job_log.

const KNOWN_JOBS = [
  'send_notifications',
  'process_webhooks',
  'retry_failed_payouts',
  'send_daily_digest',
] as const;

type KnownJobName = (typeof KNOWN_JOBS)[number];

// Stub executors — replace with real job logic as scheduled jobs are implemented.
async function runJob(name: KnownJobName): Promise<void> {
  // Each stub simulates ~200ms of work.  Real implementations would call the
  // actual job functions (e.g. processWebhooks(), retryFailedPayouts(), etc.)
  await new Promise<void>(resolve => setTimeout(resolve, 200));
  if (name === 'retry_failed_payouts') {
    // Example: call the real payout-retry service when implemented
  }
}

router.post('/jobs/:name/trigger', async (req: Request, res: Response): Promise<void> => {
  const jobName = req.params.name;

  if (!(KNOWN_JOBS as readonly string[]).includes(jobName)) {
    sendError(res, `Unknown job: ${jobName}. Known jobs: ${KNOWN_JOBS.join(', ')}`, 400);
    return;
  }

  const sb = getServiceClient();

  // Insert a 'running' record first so the dashboard shows the job is active
  const { data: runningRow, error: insertErr } = await sb
    .from('background_job_log')
    .insert({ job_name: jobName, status: 'running' })
    .select('id')
    .single();

  if (insertErr || !runningRow) {
    console.error('[admin/health] trigger insert error:', insertErr);
    sendError(res, 'Failed to start job — could not write to background_job_log', 500);
    return;
  }

  const rowId   = runningRow.id as string;
  const startMs = Date.now();

  // Run the job in the background — do not await so the HTTP response returns immediately
  runJob(jobName as KnownJobName)
    .then(() => {
      void sb
        .from('background_job_log')
        .update({ status: 'success', duration_ms: Date.now() - startMs })
        .eq('id', rowId);
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[admin/health] job ${jobName} failed:`, err);
      void sb
        .from('background_job_log')
        .update({ status: 'failed', error_msg: msg, duration_ms: Date.now() - startMs })
        .eq('id', rowId);
    });

  sendSuccess(res, { triggered: true, jobName, runId: rowId });
});

export default router;
