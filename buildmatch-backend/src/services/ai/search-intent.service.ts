import { z } from 'zod';
import anthropicClient from './anthropic.client';
import { logAiUsage } from './ai-logger.service';

const MODEL   = 'claude-haiku-4-5-20251001';
const FEATURE = 'search_intent';

// ── Response schema ──────────────────────────────────────────────────────────

const SearchIntentSchema = z.object({
  specialties: z.array(z.enum([
    'GENERAL', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'ROOFING',
    'FLOORING', 'PAINTING', 'LANDSCAPING', 'DEMOLITION', 'OTHER',
  ])).default([]),
  city:         z.string().nullable().default(null),
  state:        z.string().nullable().default(null),
  minRating:    z.number().nullable().default(null),
  available:    z.boolean().nullable().default(null),
  keywords:     z.array(z.string()).default([]),
});

export type SearchIntent = z.infer<typeof SearchIntentSchema>;

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  `You extract structured search filters from natural-language contractor search queries. ` +
  `You are part of a construction contractor marketplace called BuildMatch.\n\n` +
  `AVAILABLE SPECIALTIES (use ONLY these exact values):\n` +
  `GENERAL, ELECTRICAL, PLUMBING, HVAC, ROOFING, FLOORING, PAINTING, LANDSCAPING, DEMOLITION, OTHER\n\n` +
  `RULES:\n` +
  `- Map the user's intent to the closest specialty. Examples:\n` +
  `  "rewire" / "electrical panel" / "outlet" → ELECTRICAL\n` +
  `  "leak" / "pipes" / "water heater" / "sewer" → PLUMBING\n` +
  `  "roof" / "shingles" / "gutters" → ROOFING\n` +
  `  "ac" / "furnace" / "ductwork" / "heating" → HVAC\n` +
  `  "hardwood" / "tile" / "carpet" / "LVP" → FLOORING\n` +
  `  "paint" / "stain" / "drywall finishing" → PAINTING\n` +
  `  "deck" / "fence" / "sod" / "patio" / "yard" → LANDSCAPING\n` +
  `  "tear down" / "demo" / "removal" → DEMOLITION\n` +
  `  "renovation" / "remodel" / "addition" / "build" / "contractor" → GENERAL\n` +
  `- Extract city name if mentioned (just the city, not the state abbreviation)\n` +
  `- Extract state as a 2-letter code (e.g., TX, CA, NY) if mentioned or inferable from the city\n` +
  `  Common: Dallas→TX, Houston→TX, Chicago→IL, LA/Los Angeles→CA, NYC/New York→NY, etc.\n` +
  `- Extract any leftover keywords that could help filter (names, specific skills, etc.)\n` +
  `- If the query is vague or you cannot determine a field, set it to null / empty array\n` +
  `- minRating: only set if the user explicitly asks for highly rated / top rated / 5-star etc.\n` +
  `- available: only set to true if the user explicitly asks for "available" contractors\n\n` +
  `Respond ONLY with valid JSON. No markdown. No extra text.`;

// ── Main export ──────────────────────────────────────────────────────────────

export async function parseSearchIntent(
  query: string,
  userId?: string,
): Promise<SearchIntent | null> {
  if (!query || query.trim().length < 3) return null;

  const startMs = Date.now();

  try {
    const response = await anthropicClient.messages.create({
      model:      MODEL,
      max_tokens: 200,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: query.trim() }],
    });

    const latencyMs = Date.now() - startMs;

    void logAiUsage({
      feature:      FEATURE,
      userId,
      model:        MODEL,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      success:      true,
    }).catch(() => {});

    const block = response.content[0];
    if (!block || block.type !== 'text') return null;

    const cleaned = block.text.replace(/```json|```/g, '').trim();
    const parsed  = SearchIntentSchema.safeParse(JSON.parse(cleaned));

    if (!parsed.success) {
      console.error('[search-intent] Zod validation failed:', parsed.error.issues);
      return null;
    }

    return parsed.data;
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    console.error('[search-intent] Error:', err);

    void logAiUsage({
      feature:  FEATURE,
      userId,
      model:    MODEL,
      inputTokens: 0, outputTokens: 0,
      latencyMs,
      success:  false,
      errorMsg: err instanceof Error ? err.message : 'Unknown',
    }).catch(() => {});

    return null;
  }
}
