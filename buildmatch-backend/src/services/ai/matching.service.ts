import { z } from 'zod';
import { Job, Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import anthropicClient from './anthropic.client';
import { logAiUsage } from './ai-logger.service';
import { AppError } from '../../utils/app-error';

const MODEL   = 'claude-opus-4-5';
const FEATURE = 'matching';

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a contractor matching expert for BuildMatch, a real estate \
contractor marketplace. Given a job and candidate contractors, \
rank the top 5 best matches and explain why each is a good fit. \
Focus on: specialty relevance, experience, rating, and reliability. \
Respond ONLY with valid JSON matching this exact schema: \
{ ranked: [{ contractorId, finalScore, explanation, reasons: string[] }] } \
No markdown. No additional text outside the JSON.`;

// ── Zod schema for AI response ────────────────────────────────────────────────

const AiRankedItemSchema = z.object({
  contractorId: z.string(),
  finalScore:   z.number().min(0).max(100),
  explanation:  z.string(),
  reasons:      z.array(z.string()),
});

const AiRankingResponseSchema = z.object({
  ranked: z.array(AiRankedItemSchema),
});

type AiRankingResponse = z.infer<typeof AiRankingResponseSchema>;

// ── Exported interfaces ───────────────────────────────────────────────────────

export interface MatchedContractor {
  contractorId:        string;
  contractorProfileId: string;
  firstName:           string;
  lastName:            string;
  avatarUrl:           string | null;
  specialties:         string[];
  averageRating:       number;
  completedJobs:       number;
  yearsExperience:     number;
  hourlyRateMin:       number | null;
  hourlyRateMax:       number | null;
  city:                string | null;
  state:               string | null;
  reliabilityScore:    number;
  matchScore:          number;       // 0-100
  matchExplanation:    string;       // AI-generated 1-2 sentences; '' on fallback
  matchReasons:        string[];     // AI-generated tag strings; [] on fallback
}

export interface MatchingResult {
  matches:     MatchedContractor[];
  generatedAt: string;
  jobId:       string;
}

// ── Internal types ────────────────────────────────────────────────────────────

type ContractorRow = {
  id:                  string;
  userId:              string;
  specialties:         string[];
  averageRating:       number;
  completedJobs:       number;
  yearsExperience:     number;
  hourlyRateMin:       number | null;
  hourlyRateMax:       number | null;
  city:                string | null;
  state:               string | null;
  reliabilityScore:    number;
  user: {
    firstName: string;
    lastName:  string;
    avatarUrl: string | null;
  };
};

interface ScoredCandidate {
  profile:  ContractorRow;
  rawScore: number;
}

// ── Pre-scoring (deterministic, no AI) ───────────────────────────────────────

function preScore(profile: ContractorRow, tradeType: string): number {
  const specialtyMatch  = profile.specialties.includes(tradeType) ? 30 : 10;
  const ratingScore     = (profile.averageRating / 5) * 25;
  const experienceScore = Math.min(profile.yearsExperience / 10, 1) * 15;
  const relScore        = (profile.reliabilityScore / 100) * 20;
  const completionScore = Math.min(profile.completedJobs / 20, 1) * 10;
  return specialtyMatch + ratingScore + experienceScore + relScore + completionScore;
}

// ── Shape builder ─────────────────────────────────────────────────────────────

function buildMatch(
  candidate: ScoredCandidate,
  matchScore: number,
  matchExplanation: string,
  matchReasons: string[],
): MatchedContractor {
  const p = candidate.profile;
  return {
    contractorId:        p.userId,
    contractorProfileId: p.id,
    firstName:           p.user.firstName,
    lastName:            p.user.lastName,
    avatarUrl:           p.user.avatarUrl,
    specialties:         p.specialties,
    averageRating:       p.averageRating,
    completedJobs:       p.completedJobs,
    yearsExperience:     p.yearsExperience,
    hourlyRateMin:       p.hourlyRateMin,
    hourlyRateMax:       p.hourlyRateMax,
    city:                p.city,
    state:               p.state,
    reliabilityScore:    p.reliabilityScore,
    matchScore:          Math.round(matchScore),
    matchExplanation,
    matchReasons,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getMatchedContractors(
  jobId:      string,
  investorId: string,
): Promise<MatchingResult> {

  // Step 1 — Check cache (TTL from env, default 300 s)
  const cacheTtlMs = parseInt(process.env.AI_MATCHING_CACHE_TTL_SECONDS ?? '300', 10) * 1000;
  const cacheThreshold = new Date(Date.now() - cacheTtlMs);
  const cached = await prisma.matchingCache.findUnique({ where: { jobId } });
  if (cached && cached.generatedAt > cacheThreshold) {
    return cached.results as unknown as MatchingResult;
  }

  // Step 2 — Fetch job; must be OPEN
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'OPEN') {
    throw new AppError('Job not found or not open for matching', 404);
  }

  // Step 3 — Fetch candidate contractors
  // Prisma uses the direct DB connection (service-role) which bypasses Supabase RLS.
  const rateThreshold = job.budgetMin / 40; // rough hourly rate floor
  const candidates = await prisma.contractorProfile.findMany({
    where: {
      isAvailable: true,
      user:        { isActive: true },
      state:       job.state,
      AND: [
        {
          OR: [
            { specialties: { has: job.tradeType as string } },
            { specialties: { has: 'GENERAL' } },
          ],
        },
        {
          OR: [
            { hourlyRateMax: { gte: rateThreshold } },
            { hourlyRateMax: null },
          ],
        },
      ],
    },
    select: {
      id:               true,
      userId:           true,
      specialties:      true,
      averageRating:    true,
      completedJobs:    true,
      yearsExperience:  true,
      hourlyRateMin:    true,
      hourlyRateMax:    true,
      city:             true,
      state:            true,
      reliabilityScore: true,
      user: {
        select: {
          firstName: true,
          lastName:  true,
          avatarUrl: true,
        },
      },
    },
    take: 20,
  });

  if (candidates.length === 0) {
    return { matches: [], generatedAt: new Date().toISOString(), jobId };
  }

  // Step 4 — Pre-score; sort descending; take top 8 for AI
  const scored: ScoredCandidate[] = candidates.map((p) => ({
    profile:  p,
    rawScore: preScore(p, job.tradeType as string),
  }));
  scored.sort((a, b) => b.rawScore - a.rawScore);
  const top8 = scored.slice(0, 8);

  // Step 5 — AI ranking (returns null on any failure → graceful fallback)
  const aiRanking = await callAiRanking(top8, job, investorId);

  // Step 6 — Merge AI ranking with candidate data
  let matches: MatchedContractor[];

  if (aiRanking) {
    const byUserId = new Map(top8.map((c) => [c.profile.userId, c]));
    matches = aiRanking.ranked
      .map((item) => {
        const candidate = byUserId.get(item.contractorId);
        return candidate
          ? buildMatch(candidate, item.finalScore, item.explanation, item.reasons)
          : null;
      })
      .filter((m): m is MatchedContractor => m !== null);
  } else {
    // Fallback: top 5 pre-scored, no AI metadata
    matches = top8
      .slice(0, 5)
      .map((c) => buildMatch(c, c.rawScore, '', []));
  }

  const result: MatchingResult = {
    matches,
    generatedAt: new Date().toISOString(),
    jobId,
  };

  // Step 7 — Upsert cache; failure is non-fatal
  try {
    await prisma.matchingCache.upsert({
      where:  { jobId },
      create: { jobId, results: result as unknown as Prisma.InputJsonValue },
      update: { results: result as unknown as Prisma.InputJsonValue, generatedAt: new Date() },
    });
  } catch (cacheErr) {
    console.error('[matching.service] Cache upsert failed:', cacheErr);
  }

  return result;
}

// ── AI ranking helper ─────────────────────────────────────────────────────────

async function callAiRanking(
  top8:       ScoredCandidate[],
  job:        Pick<Job, 'title' | 'description' | 'tradeType' | 'budgetMin' | 'budgetMax' | 'city' | 'state'>,
  investorId: string,
): Promise<AiRankingResponse | null> {

  const userPrompt = JSON.stringify({
    job: {
      title:       job.title,
      description: job.description,
      tradeType:   job.tradeType,
      budgetMin:   job.budgetMin,
      budgetMax:   job.budgetMax,
      city:        job.city,
      state:       job.state,
    },
    candidates: top8.map((c) => ({
      contractorId:     c.profile.userId,
      firstName:        c.profile.user.firstName, // first name only — no full PII in prompt
      specialties:      c.profile.specialties,
      averageRating:    c.profile.averageRating,
      yearsExperience:  c.profile.yearsExperience,
      reliabilityScore: c.profile.reliabilityScore,
      completedJobs:    c.profile.completedJobs,
      city:             c.profile.city,
      state:            c.profile.state,
    })),
  });

  const startMs = Date.now();

  try {
    const maxTokens = parseInt(process.env.AI_MAX_TOKENS_MATCHING ?? '1500', 10);
    const response = await anthropicClient.messages.create({
      model:      MODEL,
      max_tokens: maxTokens,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userPrompt }],
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

    const parsed = AiRankingResponseSchema.safeParse(JSON.parse(block.text));
    if (!parsed.success) {
      console.error('[matching.service] Zod validation failed:', parsed.error.issues);
      throw new Error('AI response failed schema validation');
    }

    return parsed.data;

  } catch (err) {
    const latencyMs = Date.now() - startMs;
    console.error('[matching.service] Anthropic error:', err);

    // Log the failure — fire-and-forget, never awaited for error path
    logAiUsage({
      feature:      FEATURE,
      userId:       investorId,
      model:        MODEL,
      inputTokens:  0,
      outputTokens: 0,
      latencyMs,
      success:      false,
      errorMsg:     err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {/* logger already swallows its own errors */});

    return null; // triggers graceful fallback in caller
  }
}
