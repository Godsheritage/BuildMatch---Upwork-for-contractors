import { z } from 'zod';
import anthropicClient from './anthropic.client';
import { logAiUsage } from './ai-logger.service';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const OPUS_MODEL  = 'claude-opus-4-5';

// ── AiServiceError ────────────────────────────────────────────────────────────
// Thrown on any Anthropic failure. Route handlers catch this and return 503.

export class AiServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiServiceError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── System prompts ────────────────────────────────────────────────────────────

const QUESTIONS_SYSTEM_PROMPT =
  `You are a construction project scoping expert for BuildMatch.
 A real estate investor has provided a rough job description.
 Generate exactly 3 follow-up questions that will help clarify:
 the exact scope of work, timeline expectations, and any special
 requirements. Questions should be specific to the trade type.
 Keep each question under 20 words. Focus on things contractors
 need to know to write an accurate bid.
 Respond ONLY with valid JSON: { "questions": ["q1", "q2", "q3"] }`;

const GENERATE_SYSTEM_PROMPT = (tradeType: string, city: string, state: string, budgetMin: number, budgetMax: number) =>
  `You are a construction project scoping expert for BuildMatch.
 Generate a professional, complete job description for a real estate
 investor posting a contractor job. Use the provided rough description
 and Q&A answers to create a thorough, accurate post.
 The description should help contractors write accurate bids.
 Format: clear, professional, no jargon. Investor perspective.
 Budget context: typical ${tradeType} projects in ${city}, ${state}
  range from $${budgetMin} to $${budgetMax}.
 Respond ONLY with valid JSON matching this exact schema:
 {
   "title": "string (max 80 chars, specific and descriptive)",
   "description": "string (150-300 words, full scope)",
   "scopeOfWork": "string (bullet-style, what work is included)",
   "materialsIncluded": "string (what materials contractor should provide)",
   "bidRequirements": "string (3-4 questions contractors should answer)",
   "estimatedTimeline": "string (realistic estimate)",
   "fullDescription": "string (combined, ready to use)"
 }
 No markdown outside the JSON. No additional text.`;

// ── Zod schemas ───────────────────────────────────────────────────────────────

const QuestionsSchema = z.object({
  questions: z.array(z.string()).length(3),
});

const JobDescriptionSchema = z.object({
  title:              z.string().max(80),
  description:        z.string(),
  scopeOfWork:        z.string(),
  materialsIncluded:  z.string(),
  bidRequirements:    z.string(),
  estimatedTimeline:  z.string(),
  fullDescription:    z.string(),
});

// ── 1. generateFollowUpQuestions ──────────────────────────────────────────────

export async function generateFollowUpQuestions(params: {
  roughDescription: string;
  tradeType:        string;
  userId:           string;
}): Promise<{ questions: string[] }> {
  const { roughDescription, tradeType, userId } = params;

  const userPrompt = JSON.stringify({ roughDescription, tradeType });
  const startMs    = Date.now();

  try {
    const response = await anthropicClient.messages.create({
      model:      HAIKU_MODEL,
      max_tokens: 300,
      system:     QUESTIONS_SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userPrompt }],
    });
    const latencyMs = Date.now() - startMs;

    await logAiUsage({
      feature:      'job_assistant_questions',
      userId,
      model:        HAIKU_MODEL,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      success:      true,
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected content block type');

    const parsed = QuestionsSchema.safeParse(JSON.parse(block.text));
    if (!parsed.success) {
      console.error('[job-assistant] Questions Zod validation failed:', parsed.error.issues);
      throw new Error('AI response failed schema validation');
    }

    return parsed.data;

  } catch (err) {
    const latencyMs = Date.now() - startMs;
    console.error('[job-assistant] generateFollowUpQuestions error:', err);

    logAiUsage({
      feature:      'job_assistant_questions',
      userId,
      model:        HAIKU_MODEL,
      inputTokens:  0,
      outputTokens: 0,
      latencyMs,
      success:      false,
      errorMsg:     err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});

    throw new AiServiceError('Job assistant temporarily unavailable');
  }
}

// ── 2. generateJobDescription ─────────────────────────────────────────────────

export async function generateJobDescription(params: {
  roughDescription: string;
  tradeType:        string;
  answers:          { question: string; answer: string }[];
  budgetMin:        number;
  budgetMax:        number;
  city:             string;
  state:            string;
  userId:           string;
}): Promise<{
  title:             string;
  description:       string;
  scopeOfWork:       string;
  materialsIncluded: string;
  bidRequirements:   string;
  estimatedTimeline: string;
  fullDescription:   string;
}> {
  const { roughDescription, tradeType, answers, budgetMin, budgetMax, city, state, userId } = params;

  const userPrompt = JSON.stringify({ roughDescription, tradeType, answers });
  const systemPrompt = GENERATE_SYSTEM_PROMPT(tradeType, city, state, budgetMin, budgetMax);
  const startMs = Date.now();

  try {
    const response = await anthropicClient.messages.create({
      model:      OPUS_MODEL,
      max_tokens: 1200,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });
    const latencyMs = Date.now() - startMs;

    await logAiUsage({
      feature:      'job_assistant_generate',
      userId,
      model:        OPUS_MODEL,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      success:      true,
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected content block type');

    const parsed = JobDescriptionSchema.safeParse(JSON.parse(block.text));
    if (!parsed.success) {
      console.error('[job-assistant] JobDescription Zod validation failed:', parsed.error.issues);
      throw new Error('AI response failed schema validation');
    }

    return parsed.data;

  } catch (err) {
    const latencyMs = Date.now() - startMs;
    console.error('[job-assistant] generateJobDescription error:', err);

    logAiUsage({
      feature:      'job_assistant_generate',
      userId,
      model:        OPUS_MODEL,
      inputTokens:  0,
      outputTokens: 0,
      latencyMs,
      success:      false,
      errorMsg:     err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});

    throw new AiServiceError('Job assistant temporarily unavailable');
  }
}
