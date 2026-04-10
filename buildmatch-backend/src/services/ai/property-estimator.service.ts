import { z } from 'zod';
import anthropicClient from './anthropic.client';
import { logAiUsage } from './ai-logger.service';
import {
  getEstimatePhotos, getAnswers, updateEstimate,
  type PropertyEstimate,
} from '../property.service';

const MODEL   = 'claude-opus-4-5';
const FEATURE = 'property_estimator';

// ── Response schema ──────────────────────────────────────────────────────────

const LineItemSchema = z.object({
  category:    z.string(),
  description: z.string(),
  low:         z.number(),
  high:        z.number(),
  unit:        z.string().optional(),
  quantity:    z.number().optional(),
});

const RoomSchema = z.object({
  room:  z.string(),
  items: z.array(LineItemSchema),
  low:   z.number(),
  high:  z.number(),
});

const EstimateResultSchema = z.object({
  total_low:          z.number(),
  total_high:         z.number(),
  confidence_overall: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  line_items:         z.array(LineItemSchema),
  room_breakdown:     z.array(RoomSchema),
  ai_summary:         z.string(),
  ai_rationale:       z.string(),
  cannot_assess:      z.array(z.string()),
});

// ── Photo fetching ───────────────────────────────────────────────────────────

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp';

function detectMediaType(url: string): MediaType {
  const lower = url.toLowerCase();
  if (lower.includes('.png'))  return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function fetchPhoto(url: string): Promise<{ base64: string; mimeType: MediaType } | null> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15_000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(tid);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    return { base64: Buffer.from(buf).toString('base64'), mimeType: detectMediaType(url) };
  } catch {
    return null;
  }
}

// ── Main estimator ──────────────────────────────────────────────────────────

export async function runPropertyEstimation(
  estimate: PropertyEstimate,
  property: { address_line1: string; city: string; state: string; property_type: string; sqft_estimate: number | null; year_built: number | null },
): Promise<void> {
  const estimateId = estimate.id;

  try {
    // Fetch photos + answers in parallel
    const [photos, answers] = await Promise.all([
      getEstimatePhotos(estimateId),
      getAnswers(estimateId),
    ]);

    // Fetch photo data
    const fetched = (await Promise.all(photos.map(p => fetchPhoto(p.url)))).filter((p): p is { base64: string; mimeType: MediaType } => !!p);
    if (fetched.length === 0) {
      await updateEstimate(estimateId, {
        status: 'FAILED',
        ai_summary: 'No photos could be processed.',
        processing_finished: new Date().toISOString(),
      } as Partial<PropertyEstimate>);
      return;
    }

    // Build prompt
    const answerBlock = answers.length > 0
      ? `\n\nQuestionnaire answers:\n${answers.map(a => `- ${a.question_key}: ${a.answer}`).join('\n')}`
      : '';

    const photoLabels = photos.map(p => `  - ${p.area_label} (${p.area_key})`).join('\n');

    const systemPrompt =
      `You are a licensed general contractor and professional construction cost estimator with 25+ years of residential renovation experience across the United States. ` +
      `You are analyzing photos of a property to produce a detailed renovation cost estimate.\n\n` +
      `RULES:\n` +
      `- Base all costs on 2024-2026 regional pricing for ${property.city}, ${property.state}.\n` +
      `- Include labor + materials in every line item.\n` +
      `- If you cannot assess something from the photos, list it in cannot_assess.\n` +
      `- Respond ONLY with valid JSON matching the schema. No markdown or extra text.`;

    const userPrompt =
      `Property: ${property.address_line1}, ${property.city}, ${property.state}\n` +
      `Type: ${property.property_type} | Year built: ${property.year_built ?? 'Unknown'} | Est. sqft: ${property.sqft_estimate ?? 'Unknown'}\n` +
      `Renovation purpose: ${estimate.renovation_purpose}\n` +
      `Primary issue: ${estimate.primary_issue}\n` +
      `Photos by area:\n${photoLabels}` +
      answerBlock +
      `\n\nAnalyze the photos and produce a detailed renovation cost estimate with line items, room breakdown, total range, confidence level, summary, and rationale.`;

    const imageBlocks = fetched.map(p => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: p.mimeType, data: p.base64 },
    }));

    const startMs = Date.now();

    const response = await anthropicClient.messages.create({
      model:      MODEL,
      max_tokens: 4000,
      system:     systemPrompt,
      messages: [{
        role: 'user',
        content: [...imageBlocks, { type: 'text' as const, text: userPrompt }],
      }],
    });

    const latencyMs = Date.now() - startMs;

    await logAiUsage({
      feature:      FEATURE,
      userId:       estimate.investor_id,
      model:        MODEL,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      success:      true,
    });

    const block = response.content[0];
    if (!block || block.type !== 'text') throw new Error('Unexpected content block');

    const parsed = EstimateResultSchema.safeParse(JSON.parse(block.text));
    if (!parsed.success) {
      console.error('[property-estimator] Zod failed:', parsed.error.issues);
      throw new Error('AI response failed schema validation');
    }

    const result = parsed.data;

    await updateEstimate(estimateId, {
      status:              'COMPLETE',
      total_low:           result.total_low,
      total_high:          result.total_high,
      confidence_overall:  result.confidence_overall,
      line_items:          result.line_items as unknown,
      room_breakdown:      result.room_breakdown as unknown,
      ai_summary:          result.ai_summary,
      ai_rationale:        result.ai_rationale,
      cannot_assess:       result.cannot_assess,
      ai_model:            MODEL,
      photo_count:         fetched.length,
      processing_finished: new Date().toISOString(),
    } as Partial<PropertyEstimate>);

  } catch (err) {
    console.error('[property-estimator] Error:', err);

    const latencyMs = Date.now() - new Date(estimate.processing_started ?? Date.now()).getTime();
    logAiUsage({
      feature: FEATURE, userId: estimate.investor_id, model: MODEL,
      inputTokens: 0, outputTokens: 0, latencyMs,
      success: false, errorMsg: err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});

    await updateEstimate(estimateId, {
      status:              'FAILED',
      ai_summary:          'Estimation failed. Please try again.',
      processing_finished: new Date().toISOString(),
    } as Partial<PropertyEstimate>);
  }
}
