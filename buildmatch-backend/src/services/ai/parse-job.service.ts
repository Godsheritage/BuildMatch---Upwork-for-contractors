import { z } from 'zod';
import anthropicClient from './anthropic.client';
import { logAiUsage } from './ai-logger.service';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

const PARSE_SYSTEM_PROMPT = `You are a construction job intake assistant for BuildMatch, a platform connecting real estate investors with contractors.

A user has described a construction project in natural language. Extract every possible piece of structured information to pre-fill their job posting form as completely as possible.

Respond ONLY with a single valid JSON object — no markdown fences, no commentary, no extra text before or after.

OUTPUT SCHEMA:
{
  "title": "<string> — specific 5–15 word job title. Include trade + location when known, e.g. 'Full Kitchen Remodel in Austin, TX' or 'Roof Replacement – Rental Duplex in Chicago, IL'. NEVER null if any work is described.",
  "tradeType": "<string> — the PRIMARY trade. One of exactly: GENERAL, ELECTRICAL, PLUMBING, HVAC, ROOFING, FLOORING, PAINTING, LANDSCAPING, DEMOLITION, OTHER. Pick the dominant trade even when multiple are mentioned. Use GENERAL only for whole-home rehabs where no single trade dominates. null only if no trade can be inferred at all.",
  "budgetMin": "<integer | null> — minimum budget in USD, no symbols. null only if budget is completely absent.",
  "budgetMax": "<integer | null> — maximum budget in USD, no symbols. null only if budget is completely absent.",
  "city": "<string | null> — city name, properly capitalized. null if not stated.",
  "state": "<string | null> — exactly 2-letter uppercase US state code (TX, CA, NY, FL…). Convert full state names. null if not stated.",
  "zipCode": "<string | null> — 5-digit zip code string if stated, otherwise null.",
  "description": "<string> — professional 120–250 word description written in first person from the investor's perspective. Cover ALL details mentioned: property type, location context, specific scope of work, materials/finishes if noted, urgency or timeline if noted. Expand informal language into professional terms. If the input is sparse, flesh it out based on what a typical project of that type entails. NEVER null — always produce a description."
}

TRADE TYPE SELECTION GUIDE:
- ROOFING: roof replacement, shingles, flat roof, gutters, skylights, leak repair
- PLUMBING: pipes, water heater, drains, fixtures, bathroom/kitchen plumbing, sewer
- ELECTRICAL: wiring, panel upgrade, outlets, lighting, EV charger, rewire
- HVAC: heating, cooling, AC unit, furnace, ductwork, mini-split, ventilation
- FLOORING: hardwood, tile, carpet, LVP, laminate, subfloor
- PAINTING: interior paint, exterior paint, drywall patch + paint
- LANDSCAPING: lawn, grading, trees, irrigation, outdoor hardscape, drainage
- DEMOLITION: teardown, gut demo (use GENERAL if demo + full rebuild)
- GENERAL: full rehab, whole-home renovation, multiple major trades equally
- OTHER: specialized work not clearly fitting any above category

BUDGET EXTRACTION RULES (convert shorthand first: 5k=5000, 50k=50000, 1.5m=1500000):
- Exact number "$15,000" → min = round(value × 0.9), max = round(value × 1.1)
- Range "$10k–$20k" or "$10,000 to $20,000" → min = lower, max = upper
- "around $X" / "about $X" / "roughly $X" → min = round(X × 0.8), max = round(X × 1.2)
- "under $X" / "less than $X" / "no more than $X" → min = round(X × 0.5), max = X
- "at least $X" / "minimum $X" → min = X, max = round(X × 1.5)
- No budget mentioned → both null

DESCRIPTION WRITING RULES:
- Open with: "I am looking for a licensed contractor to…"
- Mention property type if stated (single-family, rental, duplex, commercial unit, etc.)
- Include location (city/state) if mentioned
- List every specific task or scope item the user mentioned
- Mention materials or finishes if stated
- Include timeline or urgency if mentioned ("The project should begin within…")
- Expand vague terms professionally: "fix the roof" → "repair/replace the existing roofing system"
- Do NOT invent specific square footage, permit details, or costs not mentioned by the user
- Minimum 120 words — if user input is brief, add professional context about what such a project typically involves`;


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
      max_tokens: 1000,
      system:     PARSE_SYSTEM_PROMPT,
      messages:   [
        { role: 'user',      content: text },
        { role: 'assistant', content: '{' },   // prefill forces the model to continue as raw JSON
      ],
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

    // Reconstruct full JSON: we prefilled '{' as the assistant turn, so the
    // model's content is everything after that opening brace.
    const rawText = ('{' + block.text).trim();

    let jsonData: unknown;
    try {
      jsonData = JSON.parse(rawText);
    } catch {
      console.error('[parse-job] JSON.parse failed. Raw text:', rawText);
      throw new Error('AI returned non-JSON response');
    }

    const parsed = ParsedJobSchema.safeParse(jsonData);
    if (!parsed.success) {
      console.error('[parse-job] Zod validation failed:', parsed.error.issues);
      console.error('[parse-job] Raw AI output:', rawText);
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

