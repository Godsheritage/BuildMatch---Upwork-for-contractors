import crypto from 'crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import anthropicClient from './anthropic.client';
import { logAiUsage } from './ai-logger.service';

const OPUS_MODEL  = 'claude-opus-4-5';
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const FEATURE     = 'contractor-search';

// ── System prompts ────────────────────────────────────────────────────────────

const INTENT_SYSTEM_PROMPT = `You are a construction job intent parser for BuildMatch, a contractor marketplace.
Given a user's free-text project description, extract structured search parameters.
Respond ONLY with valid JSON matching this exact schema:
{
  "tradeType": string | null,
  "state": string | null,
  "city": string | null,
  "keywords": string[],
  "scope": "small" | "medium" | "large" | null
}
tradeType must be one of: GENERAL, ELECTRICAL, PLUMBING, HVAC, ROOFING, FLOORING, PAINTING, LANDSCAPING, DEMOLITION, OTHER — or null if unclear.
state must be a US state abbreviation (e.g. "TX") or null.
city is the city name or null.
keywords are 2–5 key phrases describing the work.
scope is an estimate of project size.
Default tradeType to "GENERAL" when the query implies general construction/remodel work.
No markdown. No additional text outside the JSON.`;

const RANKING_SYSTEM_PROMPT = `You are a contractor search expert for BuildMatch, a real estate contractor marketplace.
Given a user's project description and a list of candidate contractors, rank the top 5–8 best matches.
Focus on: specialty relevance, experience, rating, reliability, and fit for the described work.
Respond ONLY with valid JSON matching this exact schema:
{ "ranked": [{ "contractorId": string, "finalScore": number, "explanation": string, "reasons": string[] }] }
finalScore is 0–100. explanation is 1–2 sentences. reasons are 2–4 short tag strings.
No markdown. No additional text outside the JSON.`;

// ── Zod schemas ───────────────────────────────────────────────────────────────

const IntentSchema = z.object({
  tradeType: z.string().nullable(),
  state:     z.string().nullable(),
  city:      z.string().nullable(),
  keywords:  z.array(z.string()),
  scope:     z.enum(['small', 'medium', 'large']).nullable(),
});

const RankedItemSchema = z.object({
  contractorId: z.string(),
  finalScore:   z.number().min(0).max(100),
  explanation:  z.string(),
  reasons:      z.array(z.string()),
});

const RankingResponseSchema = z.object({
  ranked: z.array(RankedItemSchema),
});

type Intent           = z.infer<typeof IntentSchema>;
type RankingResponse  = z.infer<typeof RankingResponseSchema>;

// ── Exported interfaces ───────────────────────────────────────────────────────

export interface SearchedContractor {
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
  matchScore:          number;
  matchExplanation:    string;
  matchReasons:        string[];
}

export interface SearchResult {
  contractors: SearchedContractor[];
  generatedAt: string;
  fromCache:   boolean;
}

// ── Internal types ────────────────────────────────────────────────────────────

type ContractorRow = {
  id:               string;
  userId:           string;
  specialties:      string[];
  averageRating:    number;
  completedJobs:    number;
  yearsExperience:  number;
  hourlyRateMin:    number | null;
  hourlyRateMax:    number | null;
  city:             string | null;
  state:            string | null;
  reliabilityScore: number;
  user: {
    firstName: string;
    lastName:  string;
    avatarUrl: string | null;
  };
};

// ── Pre-scoring (same formula as matching.service.ts) ─────────────────────────

function preScore(profile: ContractorRow, tradeType: string): number {
  const specialtyMatch  = profile.specialties.includes(tradeType) ? 30 : 10;
  const ratingScore     = (profile.averageRating / 5) * 25;
  const experienceScore = Math.min(profile.yearsExperience / 10, 1) * 15;
  const relScore        = (profile.reliabilityScore / 100) * 20;
  const completionScore = Math.min(profile.completedJobs / 20, 1) * 10;
  return specialtyMatch + ratingScore + experienceScore + relScore + completionScore;
}

function buildContractor(
  profile:   ContractorRow,
  rawScore:  number,
  score:     number,
  explanation: string,
  reasons:   string[],
): SearchedContractor {
  return {
    contractorId:        profile.userId,
    contractorProfileId: profile.id,
    firstName:           profile.user.firstName,
    lastName:            profile.user.lastName,
    avatarUrl:           profile.user.avatarUrl,
    specialties:         profile.specialties,
    averageRating:       profile.averageRating,
    completedJobs:       profile.completedJobs,
    yearsExperience:     profile.yearsExperience,
    hourlyRateMin:       profile.hourlyRateMin,
    hourlyRateMax:       profile.hourlyRateMax,
    city:                profile.city,
    state:               profile.state,
    reliabilityScore:    profile.reliabilityScore,
    matchScore:          Math.round(score > 0 ? score : rawScore),
    matchExplanation:    explanation,
    matchReasons:        reasons,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function searchContractors(
  query:  string,
  userId?: string,
): Promise<SearchResult> {

  // Step 1 — Normalize & cache check (10-min TTL)
  const normalized = query.toLowerCase().trim();
  const queryHash  = crypto.createHash('sha256').update(normalized).digest('hex');
  const tenMinAgo  = new Date(Date.now() - 10 * 60 * 1000);

  const cached = await prisma.searchCache.findUnique({ where: { queryHash } });
  if (cached && cached.generatedAt > tenMinAgo) {
    return { ...(cached.results as unknown as Omit<SearchResult, 'fromCache'>), fromCache: true };
  }

  // Step 2 — Intent extraction (Claude Haiku)
  const intent = await extractIntent(normalized, userId);

  // Step 3 — Candidate fetch
  const tradeType = intent.tradeType ?? 'GENERAL';
  const candidates = await prisma.contractorProfile.findMany({
    where: {
      isAvailable: true,
      user:        { isActive: true },
      ...(intent.state ? { state: intent.state } : {}),
      OR: [
        { specialties: { has: tradeType } },
        { specialties: { has: 'GENERAL' } },
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
    const empty: SearchResult = { contractors: [], generatedAt: new Date().toISOString(), fromCache: false };
    return empty;
  }

  // Step 4 — Pre-score, sort, take top 8
  const scored = candidates
    .map((p) => ({ profile: p, rawScore: preScore(p, tradeType) }))
    .sort((a, b) => b.rawScore - a.rawScore)
    .slice(0, 8);

  // Step 5 — AI ranking (Claude Opus); fallback to pre-scored top 5 on failure
  const aiRanking = await callAiRanking(scored, query, intent, userId);

  let contractors: SearchedContractor[];

  if (aiRanking) {
    const byUserId = new Map(scored.map((c) => [c.profile.userId, c]));
    contractors = aiRanking.ranked
      .map((item) => {
        const c = byUserId.get(item.contractorId);
        return c ? buildContractor(c.profile, c.rawScore, item.finalScore, item.explanation, item.reasons) : null;
      })
      .filter((c): c is SearchedContractor => c !== null);
  } else {
    contractors = scored.slice(0, 5).map((c) => buildContractor(c.profile, c.rawScore, c.rawScore, '', []));
  }

  const result: Omit<SearchResult, 'fromCache'> = {
    contractors,
    generatedAt: new Date().toISOString(),
  };

  // Step 6 — Upsert cache (non-fatal)
  try {
    await prisma.searchCache.upsert({
      where:  { queryHash },
      create: { queryHash, query: normalized, results: result as unknown as Prisma.InputJsonValue },
      update: { results: result as unknown as Prisma.InputJsonValue, generatedAt: new Date() },
    });
  } catch (cacheErr) {
    console.error('[contractor-search] Cache upsert failed:', cacheErr);
  }

  return { ...result, fromCache: false };
}

// ── Intent extraction (Haiku) ─────────────────────────────────────────────────

async function extractIntent(query: string, userId?: string): Promise<Intent> {
  const startMs = Date.now();
  try {
    const response = await anthropicClient.messages.create({
      model:      HAIKU_MODEL,
      max_tokens: 200,
      system:     INTENT_SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: query }],
    });
    const latencyMs = Date.now() - startMs;

    await logAiUsage({
      feature:      `${FEATURE}:intent`,
      userId,
      model:        HAIKU_MODEL,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      success:      true,
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected content block type');

    const parsed = IntentSchema.safeParse(JSON.parse(block.text));
    if (!parsed.success) throw new Error('Intent response failed schema validation');
    return parsed.data;

  } catch (err) {
    const latencyMs = Date.now() - startMs;
    console.error('[contractor-search] Intent extraction failed:', err);
    logAiUsage({
      feature:      `${FEATURE}:intent`,
      userId,
      model:        HAIKU_MODEL,
      inputTokens:  0,
      outputTokens: 0,
      latencyMs,
      success:      false,
      errorMsg:     err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});

    // Graceful fallback — treat entire query as GENERAL search, no location filter
    return { tradeType: 'GENERAL', state: null, city: null, keywords: [], scope: null };
  }
}

// ── AI ranking (Opus) ─────────────────────────────────────────────────────────

async function callAiRanking(
  scored:  { profile: ContractorRow; rawScore: number }[],
  query:   string,
  intent:  Intent,
  userId?: string,
): Promise<RankingResponse | null> {

  const userPrompt = JSON.stringify({
    projectDescription: query,
    extractedIntent:    intent,
    candidates: scored.map((c) => ({
      contractorId:     c.profile.userId,
      firstName:        c.profile.user.firstName,
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
    const response = await anthropicClient.messages.create({
      model:      OPUS_MODEL,
      max_tokens: 1500,
      system:     RANKING_SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userPrompt }],
    });
    const latencyMs = Date.now() - startMs;

    await logAiUsage({
      feature:      `${FEATURE}:ranking`,
      userId,
      model:        OPUS_MODEL,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      success:      true,
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected content block type');

    const parsed = RankingResponseSchema.safeParse(JSON.parse(block.text));
    if (!parsed.success) {
      console.error('[contractor-search] Ranking Zod validation failed:', parsed.error.issues);
      throw new Error('AI ranking response failed schema validation');
    }
    return parsed.data;

  } catch (err) {
    const latencyMs = Date.now() - startMs;
    console.error('[contractor-search] AI ranking failed:', err);
    logAiUsage({
      feature:      `${FEATURE}:ranking`,
      userId,
      model:        OPUS_MODEL,
      inputTokens:  0,
      outputTokens: 0,
      latencyMs,
      success:      false,
      errorMsg:     err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});
    return null; // triggers pre-scored fallback
  }
}
