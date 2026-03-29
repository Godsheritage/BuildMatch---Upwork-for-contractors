import { z } from 'zod';
import anthropicClient from './anthropic.client';
import { logAiUsage } from './ai-logger.service';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

const PARSE_SYSTEM_PROMPT = `You are a construction job intake assistant for BuildMatch, a platform connecting real estate investors with contractors.

A user has described a construction project in plain language. Extract structured fields from their description.

Respond ONLY with valid JSON matching this exact schema — no markdown, no extra text:
{
  "title": "string | null — a concise 5-15 word job title, e.g. 'Kitchen Remodel in Austin, TX'. null if unclear.",
  "tradeType": "string | null — one of: GENERAL, ELECTRICAL, PLUMBING, HVAC, ROOFING, FLOORING, PAINTING, LANDSCAPING, DEMOLITION, OTHER. Use GENERAL if multiple trades are involved. null if truly unclear.",
  "budgetMin": "number | null — minimum budget in USD (integer, no symbols). null if not mentioned.",
  "budgetMax": "number | null — maximum budget in USD (integer). null if not mentioned.",
  "city": "string | null — city name if mentioned, otherwise null.",
  "state": "string | null — 2-letter US state code (e.g. TX, CA, NY). Convert full state names. null if not mentioned.",
  "zipCode": "string | null — zip code string if mentioned, otherwise null.",
  "description": "string | null — a cleaned-up, professional 50-200 word version of the user description, written from the investor perspective. null if the input is too vague."
}

Budget rules:
- Single number (e.g. '$5,000'): budgetMin = value * 0.85, budgetMax = value * 1.15 (rounded).
- Range (e.g. '$5k-$8k'): use as-is.
- 'around $X' or 'about $X': budgetMin = X * 0.8, budgetMax = X * 1.2.
- No budget mentioned: both null.

Do NOT invent details the user did not provide.`;

const ParsedJobSchema = z.object({
  title:       z.string().max(120).nullable(),
  tradeType:   z.enum([
    'GENERAL', 'ELECTRICAL', 'PLUMBING', 'HVAC',
    'ROOFING', 'FLOORING', 'PAINTING', 'LANDSCAPING', 'DEMOLITION', 'OTHER',
  ]).nullable(),
  budgetMin:   z.number().positive().nullable(),
  budgetMax:   z.number().positive().nullable(),
  city:        z.string().nullable(),
  state:       z.string().max(2).nullable(),
  zipCode:     z.string().nullable(),
  description: z.string().nullable(),
});

export type ParsedJob = z.infer<typeof ParsedJobSchema>;

export class ParseJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseJobError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export async function parseJobDescription(params: {
  text:   string;
  userId: string;
}): Promise<ParsedJob> {
  const { text, userId } = params;
  const startMs = Date.now();

  try {
    const response = await anthropicClient.messages.create({
      model:      HAIKU_MODEL,
      max_tokens: 600,
      system:     PARSE_SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: text }],
    });
    const latencyMs = Date.now() - startMs;

    await logAiUsage({
      feature:      'parse_job',
      userId,
      model:        HAIKU_MODEL,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      success:      true,
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected content block type');

    const parsed = ParsedJobSchema.safeParse(JSON.parse(block.text));
    if (!parsed.success) {
      console.error('[parse-job] Zod validation failed:', parsed.error.issues);
      throw new Error('AI response failed schema validation');
    }

    return parsed.data;
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    console.error('[parse-job] error:', err);

    logAiUsage({
      feature:      'parse_job',
      userId,
      model:        HAIKU_MODEL,
      inputTokens:  0,
      outputTokens: 0,
      latencyMs,
      success:      false,
      errorMsg:     err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});

    throw new ParseJobError('Job parsing temporarily unavailable');
  }
}
