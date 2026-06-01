import { z } from 'zod';
import anthropicClient from './anthropic.client';
import { logAiUsage } from './ai-logger.service';
import { CATEGORY_COSTS, getRegionalMultiplier } from './cost-data';
import { updateEstimate, type PropertyEstimate } from '../property.service';

// ── Interfaces ───────────────────────────────────────────────────────────────

interface EstimateLineItem {
  category:           string;
  label:              string;
  condition:          string;
  scopeRecommended:   string;
  amountLow:          number;
  amountHigh:         number;
  confidence:         'LOW' | 'MEDIUM' | 'HIGH';
  evidenceFromPhotos: string;
}

interface RoomBreakdown {
  roomName:        string;
  condition:       'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  issues:          string[];
  recommendedWork: string;
}

interface PropertyEstimateResult {
  totalLow:          number;
  totalHigh:         number;
  confidenceOverall: 'LOW' | 'MEDIUM' | 'HIGH';
  summary:           string;
  lineItems:         EstimateLineItem[];
  roomBreakdown:     RoomBreakdown[];
  cannotAssess:      string[];
  rationale:         string;
}

// ── Zod schemas ──────────────────────────────────────────────────────────────

const LineItemSchema = z.object({
  category:           z.string(),
  label:              z.string(),
  condition:          z.string(),
  scopeRecommended:   z.string(),
  amountLow:          z.number(),
  amountHigh:         z.number(),
  confidence:         z.enum(['LOW', 'MEDIUM', 'HIGH']),
  evidenceFromPhotos: z.string(),
});

const RoomSchema = z.object({
  roomName:        z.string(),
  condition:       z.enum(['GOOD', 'FAIR', 'POOR', 'CRITICAL']),
  issues:          z.array(z.string()),
  recommendedWork: z.string(),
});

const ResultSchema = z.object({
  totalLow:          z.number(),
  totalHigh:         z.number(),
  confidenceOverall: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  summary:           z.string(),
  lineItems:         z.array(LineItemSchema),
  roomBreakdown:     z.array(RoomSchema),
  cannotAssess:      z.array(z.string()),
  rationale:         z.string(),
});

// ── Photo helpers ────────────────────────────────────────────────────────────

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp';

function detectMediaType(url: string): MediaType {
  const lower = url.toLowerCase();
  if (lower.includes('.png'))  return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function fetchPhotoBase64(url: string): Promise<{
  base64: string; mimeType: MediaType;
} | null> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15_000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(tid);
    if (!resp.ok) {
      console.error(`[property-estimator] Photo fetch failed (${resp.status}): ${url}`);
      return null;
    }
    const buf = await resp.arrayBuffer();
    return { base64: Buffer.from(buf).toString('base64'), mimeType: detectMediaType(url) };
  } catch (err) {
    console.error('[property-estimator] Photo fetch error:', err);
    return null;
  }
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildContextPrompt(
  params: GenerateParams,
  multiplier: number,
): string {
  const qaBlock = Object.entries(params.questionnaireAnswers)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  return (
    `PROPERTY ASSESSMENT REQUEST\n` +
    `Address: ${params.propertyAddress}\n` +
    `Property Type: ${params.propertyType}\n` +
    `Year Built: ${params.yearBuilt ?? 'Unknown'}\n` +
    `Square Footage: ${params.sqftEstimate ?? 'Unknown'}\n` +
    `Bedrooms: ${params.bedrooms}   Bathrooms: ${params.bathrooms}\n` +
    `Basement: ${params.hasBasement ? 'Yes' : 'No'}   ` +
    `Garage: ${params.hasGarage ? 'Yes' : 'No'}   ` +
    `Stories: ${params.stories}\n` +
    `Renovation Purpose: ${params.renovationPurpose}\n` +
    `Primary Issue: ${params.primaryIssue}\n` +
    `Regional Cost Multiplier: ${multiplier}x (1.0 = national average)\n` +
    `\nQUESTIONNAIRE ANSWERS:\n${qaBlock || '  (none provided)'}\n` +
    `\nCOST REFERENCE DATA FOR THIS REGION:\n` +
    `Apply ${multiplier}x to all national average costs.\n` +
    JSON.stringify(CATEGORY_COSTS, null, 2)
  );
}

function buildInstructionsPrompt(params: GenerateParams): string {
  return (
    `ANALYSIS INSTRUCTIONS:\n` +
    `Analyze every photo provided. For each room and area:\n` +
    `1. Identify all visible surfaces and their current condition\n` +
    `2. Detect all visible damage, wear, deterioration, or defects\n` +
    `3. Estimate what renovation scope is required\n` +
    `4. Apply the regional cost multiplier to all estimates\n` +
    `\n` +
    `ESTIMATION RULES:\n` +
    `- Provide ranges not single numbers (uncertainty is honest)\n` +
    `- First draw: mobilization + demo never exceeds 15% of total\n` +
    `- Flag everything you CANNOT assess from photos only\n` +
    `- Never guess at structural, electrical behind walls, or plumbing\n` +
    `  unless there is visible evidence\n` +
    `- Cosmetic renovation purpose = finish quality accordingly\n` +
    `- Flip purpose = investor-grade finishes (not luxury)\n` +
    `- Rental purpose = durable mid-grade finishes\n` +
    `\n` +
    `Respond ONLY with valid JSON matching this exact schema:\n` +
    `{\n` +
    `  "totalLow": number,\n` +
    `  "totalHigh": number,\n` +
    `  "confidenceOverall": "LOW" | "MEDIUM" | "HIGH",\n` +
    `  "summary": string (3-4 sentences, what you saw overall),\n` +
    `  "lineItems": [\n` +
    `    {\n` +
    `      "category": string,\n` +
    `      "label": string,\n` +
    `      "condition": string,\n` +
    `      "scopeRecommended": string,\n` +
    `      "amountLow": number,\n` +
    `      "amountHigh": number,\n` +
    `      "confidence": "LOW" | "MEDIUM" | "HIGH",\n` +
    `      "evidenceFromPhotos": string\n` +
    `    }\n` +
    `  ],\n` +
    `  "roomBreakdown": [\n` +
    `    {\n` +
    `      "roomName": string,\n` +
    `      "condition": "GOOD" | "FAIR" | "POOR" | "CRITICAL",\n` +
    `      "issues": string[],\n` +
    `      "recommendedWork": string\n` +
    `    }\n` +
    `  ],\n` +
    `  "cannotAssess": string[],\n` +
    `  "rationale": string\n` +
    `}\n` +
    `No markdown. No text outside the JSON object.`
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

interface GenerateParams {
  estimateId:            string;
  propertyAddress:       string;
  zipCode:               string;
  propertyType:          string;
  yearBuilt:             number | null;
  sqftEstimate:          number | null;
  bedrooms:              number;
  bathrooms:             number;
  hasBasement:           boolean;
  hasGarage:             boolean;
  stories:               number;
  renovationPurpose:     string;
  primaryIssue:          string;
  questionnaireAnswers:  Record<string, string>;
  photos: {
    areaKey:   string;
    areaLabel: string;
    url:       string;
    caption:   string | null;
  }[];
  investorId:            string;
}

const MODEL   = 'claude-opus-4-5';
const FEATURE = 'property_estimator';

const SYSTEM_PROMPT =
  'You are a licensed construction estimator with 20 years of experience ' +
  'in residential renovation. You specialize in helping real estate investors ' +
  'understand renovation costs before making offers. You are thorough, honest ' +
  'about uncertainty, and always flag what cannot be determined from visual ' +
  'inspection alone.';

export async function generatePropertyEstimate(
  params: GenerateParams,
): Promise<PropertyEstimateResult> {
  const { estimateId, investorId } = params;
  const startMs = Date.now();

  try {
    // ── Step 1: regional multiplier ────────────────────────────────────────
    const multiplier = getRegionalMultiplier(params.zipCode);

    // ── Step 2: fetch + encode photos ──────────────────────────────────────
    const photosToProcess = params.photos.slice(0, 15);
    const fetched = await Promise.all(
      photosToProcess.map(async (p) => {
        const data = await fetchPhotoBase64(p.url);
        return data ? { ...p, ...data } : null;
      }),
    );
    const photos = fetched.filter(
      (p): p is typeof photosToProcess[number] & { base64: string; mimeType: MediaType } => p !== null,
    );

    if (photos.length === 0) {
      throw new Error('No photos could be fetched — cannot produce estimate');
    }

    // Group photos by area
    const grouped = new Map<string, typeof photos>();
    for (const photo of photos) {
      const group = grouped.get(photo.areaKey) ?? [];
      group.push(photo);
      grouped.set(photo.areaKey, group);
    }

    // ── Step 3: build content blocks ───────────────────────────────────────
    const contentBlocks: Array<
      | { type: 'text'; text: string }
      | { type: 'image'; source: { type: 'base64'; media_type: MediaType; data: string } }
    > = [];

    // Context prompt
    contentBlocks.push({
      type: 'text',
      text: buildContextPrompt(params, multiplier),
    });

    // Photo groups
    for (const [areaKey, areaPhotos] of grouped) {
      const label = areaPhotos[0].areaLabel;
      contentBlocks.push({
        type: 'text',
        text: `The following ${areaPhotos.length} photo${areaPhotos.length > 1 ? 's' : ''} show: ${label}`,
      });
      for (const photo of areaPhotos) {
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: photo.mimeType, data: photo.base64 },
        });
        contentBlocks.push({
          type: 'text',
          text: `Caption: ${photo.caption || photo.areaLabel}`,
        });
      }
    }

    // Instructions
    contentBlocks.push({
      type: 'text',
      text: buildInstructionsPrompt(params),
    });

    // ── Step 6: call Anthropic ─────────────────────────────────────────────
    const response = await anthropicClient.messages.create({
      model:      MODEL,
      max_tokens: 4000,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: contentBlocks }],
    });

    const latencyMs = Date.now() - startMs;

    // ── Step 10: log usage ─────────────────────────────────────────────────
    await logAiUsage({
      feature:      FEATURE,
      userId:       investorId,
      model:        MODEL,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      success:      true,
    });

    // ── Step 7: parse + validate ───────────────────────────────────────────
    const block = response.content[0];
    if (!block || block.type !== 'text') {
      throw new Error('Unexpected content block type from Anthropic');
    }

    // Strip any accidental markdown fences
    const cleaned = block.text.replace(/```json|```/g, '').trim();
    const raw     = JSON.parse(cleaned);
    const parsed  = ResultSchema.safeParse(raw);

    if (!parsed.success) {
      console.error('[property-estimator] Zod validation failed:', parsed.error.issues);
      console.error('[property-estimator] Raw response:', block.text.slice(0, 500));
      throw new Error('AI response failed schema validation');
    }

    const result = parsed.data;

    // ── Step 8: verify totals match line items ─────────────────────────────
    const lineItemSumLow  = result.lineItems.reduce((s, i) => s + i.amountLow,  0);
    const lineItemSumHigh = result.lineItems.reduce((s, i) => s + i.amountHigh, 0);

    // If mismatch > 5%, recalculate from line items (the source of truth)
    if (result.totalLow > 0 && Math.abs(result.totalLow - lineItemSumLow) / result.totalLow > 0.05) {
      result.totalLow = lineItemSumLow;
    }
    if (result.totalHigh > 0 && Math.abs(result.totalHigh - lineItemSumHigh) / result.totalHigh > 0.05) {
      result.totalHigh = lineItemSumHigh;
    }

    // ── Step 9: update database ────────────────────────────────────────────
    await updateEstimate(estimateId, {
      status:              'COMPLETE',
      total_low:           result.totalLow,
      total_high:          result.totalHigh,
      confidence_overall:  result.confidenceOverall,
      line_items:          result.lineItems as unknown,
      room_breakdown:      result.roomBreakdown as unknown,
      ai_summary:          result.summary,
      ai_rationale:        result.rationale,
      cannot_assess:       result.cannotAssess,
      ai_model:            MODEL,
      photo_count:         photos.length,
      processing_finished: new Date().toISOString(),
    } as Partial<PropertyEstimate>);

    return result;

  } catch (err) {
    // ── Fallback: mark FAILED, log error, never throw ────────────────────
    const latencyMs = Date.now() - startMs;
    console.error(`[property-estimator] estimateId=${estimateId} error:`, err);

    logAiUsage({
      feature:  FEATURE,
      userId:   investorId,
      model:    MODEL,
      inputTokens:  0,
      outputTokens: 0,
      latencyMs,
      success:  false,
      errorMsg: err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});

    const failSummary = err instanceof Error
      ? `Estimation could not be completed: ${err.message}`
      : 'Estimation could not be completed. Please try again with clearer photos.';

    await updateEstimate(estimateId, {
      status:              'FAILED',
      ai_summary:          failSummary,
      processing_finished: new Date().toISOString(),
    } as Partial<PropertyEstimate>).catch(() => {});

    return {
      totalLow:          0,
      totalHigh:         0,
      confidenceOverall: 'LOW',
      summary:           failSummary,
      lineItems:         [],
      roomBreakdown:     [],
      cannotAssess:      ['Analysis could not be completed'],
      rationale:         'The estimation process encountered an error. Please try again.',
    };
  }
}
