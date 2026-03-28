import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import anthropicClient from './anthropic.client';
import { logAiUsage } from './ai-logger.service';
import { AppError } from '../../utils/app-error';

const MODEL   = 'claude-opus-4-5';
const FEATURE = 'bid_analysis';

// ── Cache key convention ──────────────────────────────────────────────────────
// Reuses the matching_cache table. Key is prefixed to avoid collision with job
// matching cache entries (which are keyed by plain jobId).

export function bidAnalysisCacheKey(jobId: string): string {
  return `bid_analysis_${jobId}`;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  `You are a construction bid analysis expert for BuildMatch, a real estate \
contractor marketplace. Analyze the bids received on this job and provide \
objective insights to help the investor make a smart hiring decision. \
Be specific, honest, and practical. Flag genuine concerns without being \
alarmist. Do not recommend based on price alone — factor in quality signals. \
Respond ONLY with valid JSON matching the BidAnalysis schema exactly. \
No markdown. No text outside the JSON.`;

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface BidAnalysis {
  summary:        string;
  budgetContext:  string;
  topPickId:      string | null;
  topPickReason:  string;
  redFlagIds:     string[];
  redFlags:       { contractorId: string; concern: string }[];
  insights:       string[];
  bidComparisons: {
    contractorId:    string;
    amountVsBudget:  'within' | 'above' | 'below';
    amountDeltaPct:  number;
    qualitySignal:   'strong' | 'moderate' | 'limited';
    noteForInvestor: string;
  }[];
}

// ── Zod schema ────────────────────────────────────────────────────────────────

const BidComparisonSchema = z.object({
  contractorId:    z.string(),
  amountVsBudget:  z.enum(['within', 'above', 'below']),
  amountDeltaPct:  z.number(),
  qualitySignal:   z.enum(['strong', 'moderate', 'limited']),
  noteForInvestor: z.string(),
});

const BidAnalysisSchema = z.object({
  summary:        z.string(),
  budgetContext:  z.string(),
  topPickId:      z.string().nullable(),
  topPickReason:  z.string(),
  redFlagIds:     z.array(z.string()),
  redFlags:       z.array(z.object({ contractorId: z.string(), concern: z.string() })),
  insights:       z.array(z.string()),
  bidComparisons: z.array(BidComparisonSchema),
});

// ── Validation error ──────────────────────────────────────────────────────────

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Fallback result ───────────────────────────────────────────────────────────

function fallbackAnalysis(): BidAnalysis {
  return {
    summary:        'Analysis temporarily unavailable',
    budgetContext:  '',
    topPickId:      null,
    topPickReason:  '',
    redFlagIds:     [],
    redFlags:       [],
    insights:       [],
    bidComparisons: [],
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function analyzeBids(params: {
  jobId:      string;
  investorId: string;
}): Promise<BidAnalysis> {
  const { jobId, investorId } = params;

  // Step 1 — Check cache (10-min TTL)
  const cacheKey   = bidAnalysisCacheKey(jobId);
  const tenMinAgo  = new Date(Date.now() - 10 * 60 * 1000);
  const cached     = await prisma.matchingCache.findUnique({ where: { jobId: cacheKey } });
  if (cached && cached.generatedAt > tenMinAgo) {
    return cached.results as unknown as BidAnalysis;
  }

  // Step 2 — Fetch job
  const job = await prisma.job.findUnique({
    where:  { id: jobId },
    select: { id: true, title: true, description: true, tradeType: true, budgetMin: true, budgetMax: true, investorId: true },
  });
  if (!job) throw new AppError('Job not found', 404);
  if (job.investorId !== investorId) throw new AppError('Forbidden', 403);

  // Step 3 — Fetch PENDING + ACCEPTED bids with contractor quality signals (no PII)
  const bids = await prisma.bid.findMany({
    where:  { jobId, status: { in: ['PENDING', 'ACCEPTED'] } },
    select: {
      id:           true,
      amount:       true,
      message:      true,
      status:       true,
      contractorId: true,            // userId — used to look up contractorProfile
    },
  });

  if (bids.length < 2) {
    throw new ValidationError('Not enough bids to analyze');
  }

  // Enrich with contractor profile signals; use contractorProfileId as AI identifier
  const profiles = await prisma.contractorProfile.findMany({
    where:  { userId: { in: bids.map((b) => b.contractorId) } },
    select: {
      id:                  true,
      userId:              true,
      averageRating:       true,
      completedJobs:       true,
      yearsExperience:     true,
      reliabilityScore:    true,
      totalReviews:        true,
      isLicenseVerified:   true,
    },
  });

  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

  // Step 4 — Build anonymized prompt payload (no names, no emails, no PII)
  const budgetMid = (job.budgetMin + job.budgetMax) / 2;

  const promptPayload = {
    job: {
      title:     job.title,
      tradeType: job.tradeType,
      budgetMin: job.budgetMin,
      budgetMax: job.budgetMax,
      budgetMid,
    },
    bids: bids.map((b) => {
      const profile = profileByUserId.get(b.contractorId);
      return {
        contractorId:      profile?.id ?? b.contractorId,  // contractorProfileId
        bidAmount:         b.amount,
        bidMessage:        b.message,
        averageRating:     profile?.averageRating    ?? 0,
        completedJobs:     profile?.completedJobs    ?? 0,
        yearsExperience:   profile?.yearsExperience  ?? 0,
        reliabilityScore:  profile?.reliabilityScore ?? 50,
        totalReviews:      profile?.totalReviews     ?? 0,
        isLicenseVerified: profile?.isLicenseVerified ?? false,
      };
    }),
  };

  // Step 5 — Call Anthropic; return fallback on any failure
  const startMs = Date.now();
  let analysis: BidAnalysis;

  try {
    const response = await anthropicClient.messages.create({
      model:      MODEL,
      max_tokens: 1400,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: JSON.stringify(promptPayload) }],
    });
    const latencyMs = Date.now() - startMs;

    await logAiUsage({
      feature:      FEATURE,
      userId:       investorId,
      model:        MODEL,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      success:      true,
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected content block type');

    const parsed = BidAnalysisSchema.safeParse(JSON.parse(block.text));
    if (!parsed.success) {
      console.error('[bid-analyzer] Zod validation failed:', parsed.error.issues);
      throw new Error('AI response failed schema validation');
    }

    analysis = parsed.data;

  } catch (err) {
    const latencyMs = Date.now() - startMs;
    console.error('[bid-analyzer] Anthropic error:', err);

    logAiUsage({
      feature:      FEATURE,
      userId:       investorId,
      model:        MODEL,
      inputTokens:  0,
      outputTokens: 0,
      latencyMs,
      success:      false,
      errorMsg:     err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});

    return fallbackAnalysis(); // never throws to caller
  }

  // Step 6 — Upsert cache (non-fatal)
  try {
    await prisma.matchingCache.upsert({
      where:  { jobId: cacheKey },
      create: { jobId: cacheKey, results: analysis as unknown as Prisma.InputJsonValue },
      update: { results: analysis as unknown as Prisma.InputJsonValue, generatedAt: new Date() },
    });
  } catch (cacheErr) {
    console.error('[bid-analyzer] Cache upsert failed:', cacheErr);
  }

  return analysis;
}
