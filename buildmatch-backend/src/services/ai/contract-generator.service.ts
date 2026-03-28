import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import anthropicClient from './anthropic.client';
import { logAiUsage } from './ai-logger.service';
import { AppError } from '../../utils/app-error';

const MODEL   = 'claude-opus-4-5';
const FEATURE = 'contract_generation';

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a construction contract specialist for BuildMatch, \
a real estate contractor marketplace. Generate a fully customized, professional \
construction contract based on the job details and winning bid provided. \
The contract must be fair to both parties, legally sound in plain language, \
and match the specific scope of work described.

Required sections:
1. Scope of Work — detailed list of all work to be performed
2. Exclusions — what is explicitly NOT included
3. Investor Responsibilities — site access, permits, material procurement if applicable
4. Contractor Responsibilities — labor, tools, cleanup, subcontractors
5. Timeline Estimate — start date expectations and realistic completion estimate
6. Timeline Overage Clause — how delays are handled and communicated
7. Dispute Resolution Process — steps: direct negotiation → BuildMatch mediation → arbitration
8. Payment Schedule — milestone-based aligned with the escrow milestones provided

IMPORTANT REQUIREMENTS:
- Include this exact BuildMatch clause in Dispute Resolution: \
"Any disputes not resolved within 14 days of written notice shall be submitted \
to BuildMatch mediation services. If mediation fails, binding arbitration \
shall be conducted in the jurisdiction of the project location."
- Include this exact AI disclaimer at the bottom of the fullText: \
"This contract was generated with AI assistance by BuildMatch. \
Both parties should review all terms carefully before signing."
- paymentSchedule must match the milestone structure provided exactly.
- All monetary amounts must be in USD.

Respond ONLY with valid JSON matching this exact schema. No markdown. No text outside the JSON.`;

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface GeneratedContract {
  title:                       string;
  scopeOfWork:                 string;
  exclusions:                  string;
  investorResponsibilities:    string;
  contractorResponsibilities:  string;
  timelineEstimate:            string;
  timelineOverageClause:       string;
  disputeResolutionProcess:    string;
  paymentSchedule:             PaymentScheduleItem[];
  fullText:                    string;
}

export interface PaymentScheduleItem {
  milestoneName: string;
  amount:        number;
  percentage:    number;
  description:   string;
}

export interface ContractRecord {
  id:                          string;
  jobId:                       string;
  investorId:                  string;
  contractorId:                string;
  bidId:                       string | null;
  status:                      string;
  title:                       string;
  scopeOfWork:                 string;
  exclusions:                  string | null;
  investorResponsibilities:    string | null;
  contractorResponsibilities:  string | null;
  timelineEstimate:            string | null;
  timelineOverageClause:       string | null;
  disputeResolutionProcess:    string | null;
  paymentSchedule:             Prisma.JsonValue;
  aiGenerated:                 boolean;
  aiModel:                     string | null;
  investorSignedAt:            Date | null;
  contractorSignedAt:          Date | null;
  fullText:                    string;
  createdAt:                   Date;
  updatedAt:                   Date;
}

// ── Zod schema ────────────────────────────────────────────────────────────────

const PaymentScheduleItemSchema = z.object({
  milestoneName: z.string(),
  amount:        z.number().positive(),
  percentage:    z.number().min(0).max(100),
  description:   z.string(),
});

const GeneratedContractSchema = z.object({
  title:                       z.string().min(5),
  scopeOfWork:                 z.string().min(20),
  exclusions:                  z.string(),
  investorResponsibilities:    z.string(),
  contractorResponsibilities:  z.string(),
  timelineEstimate:            z.string(),
  timelineOverageClause:       z.string(),
  disputeResolutionProcess:    z.string(),
  paymentSchedule:             z.array(PaymentScheduleItemSchema).min(1),
  fullText:                    z.string().min(100),
});

// ── Static fallback template ──────────────────────────────────────────────────

function buildFallbackContract(params: {
  jobTitle:        string;
  investorName:    string;
  contractorName:  string;
  bidAmount:       number;
  tradeType:       string;
  city:            string;
  state:           string;
  milestones:      { title: string; amount: number; percentage: number }[];
}): GeneratedContract {
  const { jobTitle, investorName, contractorName, bidAmount, tradeType, city, state, milestones } = params;

  const paymentSchedule: PaymentScheduleItem[] = milestones.map((m) => ({
    milestoneName: m.title,
    amount:        m.amount,
    percentage:    m.percentage,
    description:   `Payment of $${m.amount.toLocaleString()} released upon completion and approval of: ${m.title}`,
  }));

  const fullText = `
CONSTRUCTION SERVICES AGREEMENT

This agreement is entered into between:
  Investor: ${investorName}
  Contractor: ${contractorName}
  Project: ${jobTitle}
  Location: ${city}, ${state}
  Trade Type: ${tradeType}
  Total Contract Amount: $${bidAmount.toLocaleString()}

SCOPE OF WORK
Contractor agrees to perform all ${tradeType.toLowerCase()} work as described in the BuildMatch job posting for "${jobTitle}". Specific scope to be agreed upon in writing before work commences.

EXCLUSIONS
Any work not explicitly listed in the scope of work is excluded. Additional work requires a written change order signed by both parties.

INVESTOR RESPONSIBILITIES
Investor shall provide site access, necessary permits (unless otherwise agreed), and timely approvals for milestone completions.

CONTRACTOR RESPONSIBILITIES
Contractor shall supply all labor, tools, and materials (unless otherwise specified), maintain a clean worksite, and comply with all applicable building codes.

TIMELINE
Timeline to be agreed in writing before work commences. Contractor shall provide written notice of any expected delays within 48 hours of becoming aware of the delay.

DISPUTE RESOLUTION
Any disputes not resolved within 14 days of written notice shall be submitted to BuildMatch mediation services. If mediation fails, binding arbitration shall be conducted in the jurisdiction of the project location.

PAYMENT SCHEDULE
${paymentSchedule.map((p, i) => `Milestone ${i + 1} — ${p.milestoneName}: $${p.amount.toLocaleString()} (${p.percentage}%)`).join('\n')}

This contract was generated with AI assistance by BuildMatch. Both parties should review all terms carefully before signing.
`.trim();

  return {
    title:                       `Construction Services Agreement — ${jobTitle}`,
    scopeOfWork:                 `All ${tradeType.toLowerCase()} work as described in the BuildMatch job posting for "${jobTitle}". Specific scope to be detailed before work commences.`,
    exclusions:                  'Any work not explicitly listed in the scope of work. Additional work requires a written change order.',
    investorResponsibilities:    'Provide site access, necessary permits (unless otherwise agreed), and timely milestone approvals.',
    contractorResponsibilities:  'Supply all labor, tools, and materials (unless specified otherwise), maintain clean worksite, comply with applicable building codes.',
    timelineEstimate:            'To be agreed in writing before work commences.',
    timelineOverageClause:       'Contractor shall provide written notice of delays within 48 hours of becoming aware.',
    disputeResolutionProcess:    'Any disputes not resolved within 14 days of written notice shall be submitted to BuildMatch mediation services. If mediation fails, binding arbitration shall be conducted in the jurisdiction of the project location.',
    paymentSchedule,
    fullText,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateContract(params: {
  jobId:      string;
  bidId:      string;
  investorId: string;
}): Promise<ContractRecord> {
  const { jobId, bidId, investorId } = params;

  // Step 1 — Fetch job with owner check
  const job = await prisma.job.findUnique({
    where:  { id: jobId },
    select: {
      id: true, title: true, description: true, tradeType: true,
      budgetMin: true, budgetMax: true, city: true, state: true,
      status: true, investorId: true,
      investor: { select: { firstName: true, lastName: true } },
    },
  });

  if (!job)                        throw new AppError('Job not found', 404);
  if (job.investorId !== investorId) throw new AppError('Forbidden', 403);
  if (job.status !== 'AWARDED')    throw new AppError('Contract can only be generated for an awarded job', 400);

  // Step 2 — Fetch the accepted bid (includes contractorId = User.id)
  const bid = await prisma.bid.findFirst({
    where: { id: bidId, jobId, status: 'ACCEPTED' },
    select: { id: true, amount: true, message: true, contractorId: true },
  });

  if (!bid) throw new AppError('Accepted bid not found', 404);

  const contractorUserId = bid.contractorId;

  const [contractorUser, contractorProfile, escrowPayment] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: contractorUserId },
      select: { firstName: true, lastName: true },
    }),
    prisma.contractorProfile.findUnique({
      where:  { userId: contractorUserId },
      select: { yearsExperience: true, specialties: true, licenseNumber: true },
    }),
    prisma.escrowPayment.findUnique({
      where:   { jobId },
      include: { milestones: { orderBy: { order: 'asc' } } },
    }),
  ]);

  const investorName   = `${job.investor.firstName} ${job.investor.lastName}`;
  const contractorName = contractorUser ? `${contractorUser.firstName} ${contractorUser.lastName}` : 'Contractor';

  const milestones = escrowPayment?.milestones.map((m) => ({
    title:      m.title,
    amount:     m.amount,
    percentage: m.percentage,
    description: m.description ?? '',
  })) ?? [];

  // Step 4 — Check no existing active contract
  const existingActive = await prisma.contract.findFirst({
    where: { jobId, status: { in: ['PENDING_SIGNATURES', 'ACTIVE'] } },
    select: { id: true },
  });
  if (existingActive) throw new AppError('An active contract already exists for this job', 409);

  // Step 5 — Build AI prompt payload
  const promptPayload = {
    job: {
      title:       job.title,
      description: job.description,
      tradeType:   job.tradeType,
      budgetMin:   job.budgetMin,
      budgetMax:   job.budgetMax,
      city:        job.city,
      state:       job.state,
    },
    bid: {
      amount:  bid.amount,
      message: bid.message,
    },
    contractor: {
      yearsExperience: contractorProfile?.yearsExperience ?? 0,
      specialties:     contractorProfile?.specialties     ?? [],
      isLicensed:      !!contractorProfile?.licenseNumber,
    },
    parties: {
      investorName,
      contractorName,
    },
    milestones: milestones.length > 0 ? milestones : [{
      title:       'Project Completion',
      amount:      bid.amount,
      percentage:  100,
      description: 'Full payment upon satisfactory project completion',
    }],
  };

  // Step 6 — Call Anthropic; fall back to static template on any failure
  const startMs = Date.now();
  let generated: GeneratedContract;
  let usedAi    = true;

  try {
    const response = await anthropicClient.messages.create({
      model:      MODEL,
      max_tokens: 3000,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: JSON.stringify(promptPayload) }],
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

    const parsed = GeneratedContractSchema.safeParse(JSON.parse(block.text));
    if (!parsed.success) {
      console.error('[contract-generator] Zod validation failed:', parsed.error.issues);
      throw new Error('AI response failed schema validation');
    }

    generated = parsed.data;

  } catch (err) {
    const latencyMs = Date.now() - startMs;
    console.error('[contract-generator] Anthropic error:', err);

    logAiUsage({
      feature:      FEATURE,
      userId:       investorId,
      model:        MODEL,
      inputTokens:  0,
      outputTokens: 0,
      latencyMs,
      success:      false,
      errorMsg:     err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});

    usedAi    = false;
    generated = buildFallbackContract({
      jobTitle:       job.title,
      investorName,
      contractorName,
      bidAmount:      bid.amount,
      tradeType:      job.tradeType,
      city:           job.city,
      state:          job.state,
      milestones:     promptPayload.milestones,
    });
  }

  // Step 7 — Persist contract with status PENDING_SIGNATURES
  const contract = await prisma.contract.create({
    data: {
      jobId,
      investorId,
      contractorId:               contractorUserId,
      bidId,
      status:                     'PENDING_SIGNATURES',
      title:                      generated.title,
      scopeOfWork:                generated.scopeOfWork,
      exclusions:                 generated.exclusions,
      investorResponsibilities:   generated.investorResponsibilities,
      contractorResponsibilities: generated.contractorResponsibilities,
      timelineEstimate:           generated.timelineEstimate,
      timelineOverageClause:      generated.timelineOverageClause,
      disputeResolutionProcess:   generated.disputeResolutionProcess,
      paymentSchedule:            generated.paymentSchedule as unknown as Prisma.InputJsonValue,
      aiGenerated:                usedAi,
      aiModel:                    usedAi ? MODEL : null,
      fullText:                   generated.fullText,
    },
  });

  return contract as ContractRecord;
}
