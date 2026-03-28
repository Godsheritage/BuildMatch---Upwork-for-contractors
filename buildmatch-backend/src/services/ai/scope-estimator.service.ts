import { z } from 'zod';
import anthropicClient from './anthropic.client';
import { logAiUsage } from './ai-logger.service';

const MODEL   = 'claude-opus-4-5';
const FEATURE = 'scope_estimator';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ScopeEstimate {
  projectType:       string;
  estimatedSqFt:     number | null;
  budgetRangeLow:    number;
  budgetRangeHigh:   number;
  scopeItems:        string[];
  materialsLikely:   string[];
  complexityLevel:   'light' | 'moderate' | 'heavy';
  estimatedDuration: string;
  confidence:        'low' | 'medium' | 'high';
  caveat:            string;
}

// ── Zod schema ────────────────────────────────────────────────────────────────

const ScopeEstimateSchema = z.object({
  projectType:       z.string(),
  estimatedSqFt:     z.number().nullable(),
  budgetRangeLow:    z.number(),
  budgetRangeHigh:   z.number(),
  scopeItems:        z.array(z.string()),
  materialsLikely:   z.array(z.string()),
  complexityLevel:   z.enum(['light', 'moderate', 'heavy']),
  estimatedDuration: z.string(),
  confidence:        z.enum(['low', 'medium', 'high']),
  caveat:            z.string(),
});

// ── Prompts ───────────────────────────────────────────────────────────────────

function buildSystemPrompt(tradeType: string, city: string, state: string): string {
  return (
    `You are a construction cost estimator with 20 years of experience. ` +
    `Analyze the provided photos of a property that needs ${tradeType} work. ` +
    `Based on visible conditions in the photos, estimate the scope and cost. ` +
    `Be realistic. Account for regional pricing in ${city}, ${state}. ` +
    `If photos are unclear or insufficient: set confidence to 'low'. ` +
    `Respond ONLY with valid JSON matching the ScopeEstimate schema. ` +
    `No markdown. No additional text outside the JSON. ` +
    `Important: always include the caveat about estimates being based on visible conditions only.`
  );
}

function buildUserPrompt(tradeType: string, city: string, state: string): string {
  return (
    `These photos show a property needing ${tradeType} work in ${city}, ${state}. ` +
    `Analyze the visible conditions and provide a detailed scope estimate. ` +
    `Focus on what you can actually see in the photos.`
  );
}

// ── Fallback ──────────────────────────────────────────────────────────────────

export function fallbackEstimate(): ScopeEstimate {
  return {
    projectType:       'Unable to analyze — please fill in manually',
    estimatedSqFt:     null,
    budgetRangeLow:    0,
    budgetRangeHigh:   0,
    scopeItems:        [],
    materialsLikely:   [],
    complexityLevel:   'moderate',
    estimatedDuration: 'Unknown',
    confidence:        'low',
    caveat:            'Estimates based on visible conditions only',
  };
}

// ── Photo fetching ────────────────────────────────────────────────────────────

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

function detectMediaType(url: string): MediaType {
  const lower = url.toLowerCase();
  if (lower.includes('.png'))  return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif'))  return 'image/gif';
  return 'image/jpeg';
}

interface FetchedPhoto {
  base64:   string;
  mimeType: MediaType;
}

async function fetchPhotoAsBase64(url: string): Promise<FetchedPhoto | null> {
  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 10_000);

    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.error(`[scope-estimator] Failed to fetch photo (${resp.status}): ${url}`);
      return null;
    }

    const buffer = await resp.arrayBuffer();
    return {
      base64:   Buffer.from(buffer).toString('base64'),
      mimeType: detectMediaType(url),
    };
  } catch (err) {
    console.error('[scope-estimator] Photo fetch error:', err);
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function estimateScopeFromPhotos(params: {
  photoUrls: string[];
  tradeType: string;
  city:      string;
  state:     string;
  userId:    string;
}): Promise<ScopeEstimate> {
  const { photoUrls, tradeType, city, state, userId } = params;

  // Step 1 — Limit to first 5 photos
  const urlsToProcess = photoUrls.slice(0, 5);

  // Step 2 — Fetch photos concurrently, skip any that fail
  const photoResults = await Promise.all(urlsToProcess.map(fetchPhotoAsBase64));
  const photos       = photoResults.filter((p): p is FetchedPhoto => p !== null);

  if (photos.length === 0) {
    console.error('[scope-estimator] No photos could be fetched; returning fallback');
    return fallbackEstimate();
  }

  // Step 3 — Build Anthropic image content blocks
  const imageBlocks = photos.map((photo) => ({
    type:   'image' as const,
    source: {
      type:       'base64'         as const,
      media_type: photo.mimeType,
      data:        photo.base64,
    },
  }));

  const systemPrompt = buildSystemPrompt(tradeType, city, state);
  const userText     = buildUserPrompt(tradeType, city, state);

  // Step 4 — Call Anthropic with vision
  const startMs = Date.now();
  let estimate: ScopeEstimate;

  try {
    const response = await anthropicClient.messages.create({
      model:      MODEL,
      max_tokens: 800,
      system:     systemPrompt,
      messages: [
        {
          role:    'user',
          content: [
            ...imageBlocks,
            { type: 'text' as const, text: userText },
          ],
        },
      ],
    });

    const latencyMs = Date.now() - startMs;

    await logAiUsage({
      feature:      FEATURE,
      userId,
      model:        MODEL,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      success:      true,
    });

    const block = response.content[0];
    if (!block || block.type !== 'text') throw new Error('Unexpected content block type');

    const parsed = ScopeEstimateSchema.safeParse(JSON.parse(block.text));
    if (!parsed.success) {
      console.error('[scope-estimator] Zod validation failed:', parsed.error.issues);
      throw new Error('AI response failed schema validation');
    }

    estimate = parsed.data;

  } catch (err) {
    const latencyMs = Date.now() - startMs;
    console.error('[scope-estimator] Anthropic error:', err);

    logAiUsage({
      feature:      FEATURE,
      userId,
      model:        MODEL,
      inputTokens:  0,
      outputTokens: 0,
      latencyMs,
      success:      false,
      errorMsg:     err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});

    return fallbackEstimate();
  }

  return estimate;
}
