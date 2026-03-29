/**
 * src/routes/admin/health.routes.ts
 * Mounted at: /api/admin/health
 *
 * Endpoints:
 *   GET /api/admin/health        — deep health check (DB ping, Supabase, Anthropic key presence)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../../utils/response.utils';
import prisma from '../../lib/prisma';
import { getServiceClient } from '../../lib/supabase';

const router = Router();

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const checks: Record<string, 'ok' | 'error'> = {};

  // Prisma / PostgreSQL
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  // Supabase service client
  try {
    const { error } = await getServiceClient().from('audit_log').select('id').limit(1);
    checks.supabase = error ? 'error' : 'ok';
  } catch {
    checks.supabase = 'error';
  }

  // Anthropic API key present
  checks.anthropic = process.env.ANTHROPIC_API_KEY ? 'ok' : 'error';

  const allOk = Object.values(checks).every(v => v === 'ok');
  const body  = { status: allOk ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() };
  res.status(allOk ? 200 : 503).json({ success: allOk, data: body });
});

export default router;
