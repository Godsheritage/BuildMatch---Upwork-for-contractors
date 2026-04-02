import { z }               from 'zod';
import { randomUUID }       from 'crypto';
import anthropicClient      from './anthropic.client';
import { getServiceClient } from '../../lib/supabase';
import prisma               from '../../lib/prisma';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DrawTemplate {
  drawNumber:         number;
  title:              string;
  percentage:         number;
  completionCriteria: string;
}

export interface GeneratedSchedule {
  draws: {
    drawNumber:         number;
    title:              string;
    description:        string;
    completionCriteria: string;
    percentage:         number;
    amount:             number;
    estimatedDueDays:   number;
  }[];
  rationale:    string;
  templateUsed: string;
}

// ── Draw templates ─────────────────────────────────────────────────────────────

const DRAW_TEMPLATES: Record<string, DrawTemplate[]> = {
  FULL_RENOVATION: [
    { drawNumber: 1, title: 'Kickoff & Demo',      percentage: 10,
      completionCriteria: 'Signed contract, demo complete, materials ordered, site secured' },
    { drawNumber: 2, title: 'Rough-In Work',        percentage: 25,
      completionCriteria: 'Rough electrical, plumbing, HVAC, framing complete, ready for inspection' },
    { drawNumber: 3, title: 'Mid-Point Inspection', percentage: 25,
      completionCriteria: 'Inspections passed, drywall installed, flooring substrate in place' },
    { drawNumber: 4, title: 'Finish Work',          percentage: 25,
      completionCriteria: 'Trim, cabinets, fixtures, flooring installed, paint complete' },
    { drawNumber: 5, title: 'Final Punch List',     percentage: 15,
      completionCriteria: 'All punch list items addressed, final inspection passed, site clean' },
  ],
  KITCHEN_REMODEL: [
    { drawNumber: 1, title: 'Demo & Rough-In',        percentage: 20,
      completionCriteria: 'Existing kitchen demo, rough plumbing and electrical roughed in' },
    { drawNumber: 2, title: 'Cabinets & Countertops', percentage: 35,
      completionCriteria: 'Cabinets installed and level, countertops templated or installed' },
    { drawNumber: 3, title: 'Appliances & Fixtures',  percentage: 30,
      completionCriteria: 'Appliances set, plumbing connected, electrical complete, backsplash done' },
    { drawNumber: 4, title: 'Final Completion',        percentage: 15,
      completionCriteria: 'Punch list complete, final walkthrough approved, site clean' },
  ],
  BATHROOM_REMODEL: [
    { drawNumber: 1, title: 'Demo & Rough-In',   percentage: 25,
      completionCriteria: 'Demo complete, rough plumbing repositioned if needed, waterproofing done' },
    { drawNumber: 2, title: 'Tile & Surround',   percentage: 35,
      completionCriteria: 'Floor and wall tile installed and grouted, shower pan complete' },
    { drawNumber: 3, title: 'Fixtures & Finish', percentage: 40,
      completionCriteria: 'Vanity, toilet, fixtures, mirrors, and accessories installed' },
  ],
  ROOF_REPLACEMENT: [
    { drawNumber: 1, title: 'Material Delivery', percentage: 30,
      completionCriteria: 'Materials delivered to site, old roof torn off, decking inspected' },
    { drawNumber: 2, title: 'Installation',       percentage: 55,
      completionCriteria: 'New roofing fully installed, flashing complete, gutters replaced' },
    { drawNumber: 3, title: 'Final Inspection',   percentage: 15,
      completionCriteria: 'Final inspection passed, cleanup complete, no leaks confirmed' },
  ],
  HVAC_REPLACEMENT: [
    { drawNumber: 1, title: 'Equipment Delivery',    percentage: 25,
      completionCriteria: 'Equipment delivered, existing system removed, rough-in started' },
    { drawNumber: 2, title: 'Installation Complete', percentage: 60,
      completionCriteria: 'System fully installed, ductwork complete, wired and tested' },
    { drawNumber: 3, title: 'Commissioning',         percentage: 15,
      completionCriteria: 'System commissioned, all zones tested, manual and warranty delivered' },
  ],
  FLOORING: [
    { drawNumber: 1, title: 'Prep & Material Delivery', percentage: 30,
      completionCriteria: 'Subfloor prepped, materials delivered and acclimated' },
    { drawNumber: 2, title: 'Installation',              percentage: 55,
      completionCriteria: 'Flooring fully installed, transitions and trim complete' },
    { drawNumber: 3, title: 'Final Inspection',          percentage: 15,
      completionCriteria: 'Final walk, all defects corrected, site clean' },
  ],
  PAINTING: [
    { drawNumber: 1, title: 'Prep Work',             percentage: 30,
      completionCriteria: 'Surfaces patched, primed, trim prepped, caulking done' },
    { drawNumber: 2, title: 'Paint Application',     percentage: 55,
      completionCriteria: 'All coats applied, cut-in work complete, first coat on trim' },
    { drawNumber: 3, title: 'Final Coat & Touch-Up', percentage: 15,
      completionCriteria: 'Final coat done, touch-ups complete, hardware reinstalled' },
  ],
  ELECTRICAL: [
    { drawNumber: 1, title: 'Rough-In', percentage: 40,
      completionCriteria: 'Panel work, new circuits rough-in, inspection passed' },
    { drawNumber: 2, title: 'Trim-Out', percentage: 45,
      completionCriteria: 'Devices, fixtures, panel covers installed and tested' },
    { drawNumber: 3, title: 'Final',    percentage: 15,
      completionCriteria: 'Final inspection passed, all fixtures operational' },
  ],
  PLUMBING: [
    { drawNumber: 1, title: 'Rough-In', percentage: 40,
      completionCriteria: 'All rough-in plumbing installed and pressure tested' },
    { drawNumber: 2, title: 'Trim-Out', percentage: 45,
      completionCriteria: 'All fixtures, valves, and connections installed and tested' },
    { drawNumber: 3, title: 'Final',    percentage: 15,
      completionCriteria: 'Final inspection passed, no leaks confirmed' },
  ],
  FOUNDATION_STRUCTURAL: [
    { drawNumber: 1, title: 'Mobilization & Excavation', percentage: 20,
      completionCriteria: 'Site mobilized, excavation or access complete, materials on site' },
    { drawNumber: 2, title: 'Structural Work',           percentage: 50,
      completionCriteria: 'Primary structural repairs or pours complete, forms stripped' },
    { drawNumber: 3, title: 'Waterproofing & Backfill',  percentage: 20,
      completionCriteria: 'Waterproofing applied, drainage installed, backfill complete' },
    { drawNumber: 4, title: 'Final Inspection',          percentage: 10,
      completionCriteria: 'Engineering sign-off, final inspection passed, site restored' },
  ],
  GENERAL: [
    { drawNumber: 1, title: 'Kickoff',                percentage: 20,
      completionCriteria: 'Contract signed, materials ordered, mobilization complete' },
    { drawNumber: 2, title: 'Mid-Point',              percentage: 40,
      completionCriteria: '50% of scope visibly complete per agreed scope of work' },
    { drawNumber: 3, title: 'Substantial Completion', percentage: 30,
      completionCriteria: 'All primary work complete, minor punch list only remaining' },
    { drawNumber: 4, title: 'Final',                  percentage: 10,
      completionCriteria: 'Punch list cleared, final inspection if applicable, site clean' },
  ],
};

// ── Template mapping ───────────────────────────────────────────────────────────

function mapTradeTypeToTemplate(tradeType: string): string {
  const map: Record<string, string> = {
    PLUMBING:           'PLUMBING',
    ELECTRICAL:         'ELECTRICAL',
    KITCHEN:            'KITCHEN_REMODEL',
    BATHROOM:           'BATHROOM_REMODEL',
    HVAC:               'HVAC_REPLACEMENT',
    ROOFING:            'ROOF_REPLACEMENT',
    FLOORING:           'FLOORING',
    PAINTING:           'PAINTING',
    FOUNDATION:         'FOUNDATION_STRUCTURAL',
    STRUCTURAL:         'FOUNDATION_STRUCTURAL',
    FULL_RENOVATION:    'FULL_RENOVATION',
    GENERAL_CONTRACTOR: 'FULL_RENOVATION',
  };
  return map[tradeType.toUpperCase()] ?? 'GENERAL';
}

// ── Fallback due-days by budget ────────────────────────────────────────────────

function estimateDueDays(totalBudget: number, drawIndex: number, totalDraws: number): number {
  const projectDays = totalBudget < 10_000 ? 30 : totalBudget < 50_000 ? 90 : 180;
  return Math.round((projectDays / totalDraws) * (drawIndex + 1));
}

// ── Zod schema for AI response ─────────────────────────────────────────────────

const AiDrawSchema = z.object({
  drawNumber:         z.number().int().positive(),
  title:              z.string().min(1),
  description:        z.string().min(1),
  completionCriteria: z.string().min(1),
  percentage:         z.number().positive(),
  estimatedDueDays:   z.number().int().positive(),
});

const AiResponseSchema = z.object({
  draws:    z.array(AiDrawSchema).min(2).max(6),
  rationale: z.string(),
});

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a construction project financial specialist for BuildMatch.
Your job is to generate a fair, industry-standard draw schedule
for a construction job between a real estate investor and a contractor.
A draw schedule determines when the contractor gets paid as they
complete milestones. It protects the investor from paying for work
not done, and protects the contractor from not getting paid for
work completed.
Rules for a good draw schedule:
  - First draw never exceeds 15% (covers mobilization only)
  - No single draw exceeds 35% (prevents over-payment risk)
  - Final draw is always at least 10% (retainage ensures completion)
  - All percentages must sum to exactly 100
  - Milestones must be objectively verifiable, not subjective
  - Completion criteria must be specific and observable
  - Estimated due days must be realistic for the budget size
Respond ONLY with valid JSON. No markdown. No text outside JSON.`;

// ── Main export ────────────────────────────────────────────────────────────────

export async function generateDrawSchedule(params: {
  jobId:           string;
  jobTitle:        string;
  jobDescription:  string;
  tradeType:       string;
  totalBudget:     number;
  bidMessage?:     string;
}): Promise<GeneratedSchedule> {
  const templateKey = mapTradeTypeToTemplate(params.tradeType);
  const baseline    = DRAW_TEMPLATES[templateKey];
  const startMs     = Date.now();

  // ── Step 3: Call Anthropic ───────────────────────────────────────────────────
  let aiResult: z.infer<typeof AiResponseSchema> | null = null;
  let inputTokens  = 0;
  let outputTokens = 0;
  let aiSuccess    = false;

  try {
    const userPrompt =
`Job: ${params.jobTitle}
Description: ${params.jobDescription}
Trade Type: ${params.tradeType}
Total Budget: $${params.totalBudget.toLocaleString()}
Bid Notes: ${params.bidMessage ?? 'Not provided'}

Baseline template (customize this for the specific job):
${JSON.stringify(baseline, null, 2)}

Customize the milestone titles, completion criteria, amounts,
and estimated due dates for this specific job.
Keep the same number of draws as the baseline unless the
job description clearly warrants adding or removing one.
Return JSON matching this shape exactly:
{
  "draws": [
    {
      "drawNumber": 1,
      "title": "...",
      "description": "one sentence describing the work in this phase",
      "completionCriteria": "specific, observable criteria",
      "percentage": 15,
      "estimatedDueDays": 14
    }
  ],
  "rationale": "one sentence explaining why this schedule suits this job"
}`;

    const resp = await anthropicClient.messages.create({
      model:       'claude-opus-4-5',
      max_tokens:  1200,
      temperature: 0.2,
      system:      SYSTEM_PROMPT,
      messages:    [{ role: 'user', content: userPrompt }],
    });

    inputTokens  = resp.usage.input_tokens;
    outputTokens = resp.usage.output_tokens;

    const raw    = resp.content[0].type === 'text' ? resp.content[0].text : '';
    const parsed = AiResponseSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      console.error('[draw-schedule.service] Zod parse failed:', parsed.error.issues);
    } else {
      const pctSum = parsed.data.draws.reduce((s, d) => s + d.percentage, 0);
      if (Math.abs(pctSum - 100) > 0.5) {
        console.error('[draw-schedule.service] percentages sum to', pctSum, '— using fallback');
      } else {
        aiResult  = parsed.data;
        aiSuccess = true;
      }
    }
  } catch (err) {
    console.error('[draw-schedule.service] Anthropic error:', err);
  }

  // ── Log to ai_usage_log ──────────────────────────────────────────────────────
  prisma.aiUsageLog.create({
    data: {
      feature:      'draw_schedule_generator',
      model:        'claude-opus-4-5',
      inputTokens,
      outputTokens,
      latencyMs:    Date.now() - startMs,
      success:      aiSuccess,
      errorMsg:     aiSuccess ? null : 'AI generation failed — fallback used',
    },
  }).catch((err: unknown) => console.error('[draw-schedule.service] usage log error:', err));

  // ── Step 4: Build draws array (fallback if AI failed) ───────────────────────
  let rawDraws: GeneratedSchedule['draws'];

  if (aiResult) {
    rawDraws = aiResult.draws.map((d) => ({
      drawNumber:         d.drawNumber,
      title:              d.title,
      description:        d.description,
      completionCriteria: d.completionCriteria,
      percentage:         d.percentage,
      amount:             Math.round((d.percentage / 100) * params.totalBudget * 100) / 100,
      estimatedDueDays:   d.estimatedDueDays,
    }));
  } else {
    rawDraws = baseline.map((t, i) => ({
      drawNumber:         t.drawNumber,
      title:              t.title,
      description:        t.completionCriteria,
      completionCriteria: t.completionCriteria,
      percentage:         t.percentage,
      amount:             Math.round((t.percentage / 100) * params.totalBudget * 100) / 100,
      estimatedDueDays:   estimateDueDays(params.totalBudget, i, baseline.length),
    }));
  }

  // Correct rounding drift on the last draw so amounts sum exactly to totalBudget
  const amountSum = rawDraws.reduce((s, d) => s + d.amount, 0);
  const drift     = Math.round((params.totalBudget - amountSum) * 100) / 100;
  if (drift !== 0) rawDraws[rawDraws.length - 1].amount += drift;

  const schedule: GeneratedSchedule = {
    draws:        rawDraws,
    rationale:    aiResult ? aiResult.rationale : 'Standard template applied',
    templateUsed: templateKey,
  };

  // ── Step 5: Save to database via Supabase service client ─────────────────────
  try {
    const supabase   = getServiceClient();
    const scheduleId = randomUUID();
    const now        = new Date().toISOString();

    const { error: schedErr } = await supabase
      .from('draw_schedules')
      .insert({
        id:           scheduleId,
        jobId:        params.jobId,
        status:       'DRAFT',
        totalAmount:  params.totalBudget,
        drawCount:    rawDraws.length,
        aiGenerated:  aiSuccess,
        createdAt:    now,
        updatedAt:    now,
      });

    if (schedErr) {
      console.error('[draw-schedule.service] schedule insert error:', schedErr.message);
      return schedule;
    }

    const milestoneRows = rawDraws.map((d) => ({
      id:                 randomUUID(),
      scheduleId,
      jobId:              params.jobId,
      drawNumber:         d.drawNumber,
      title:              d.title,
      description:        d.description,
      completionCriteria: d.completionCriteria,
      percentage:         d.percentage,
      amount:             d.amount,
      status:             'PENDING',
      createdAt:          now,
    }));

    const { error: msErr } = await supabase
      .from('draw_milestones')
      .insert(milestoneRows);

    if (msErr) {
      console.error('[draw-schedule.service] milestones insert error:', msErr.message);
    }
  } catch (err) {
    console.error('[draw-schedule.service] DB save error:', err);
  }

  return schedule;
}

// ── Helpers re-exported for the controller ────────────────────────────────────

export { DRAW_TEMPLATES, mapTradeTypeToTemplate };

/** Return the template array for a given trade type (no AI, no DB). */
export function getTemplateForTrade(tradeType: string): DrawTemplate[] {
  const key = mapTradeTypeToTemplate(tradeType);
  return DRAW_TEMPLATES[key];
}
