import { z } from 'zod';
import prisma from '../../lib/prisma';
import anthropicClient from './anthropic.client';
import { logAiUsage } from './ai-logger.service';

const MODEL   = 'claude-haiku-4-5-20251001';
const FEATURE = 'reliability_score';

const SYSTEM_PROMPT =
  `You are a performance coach for BuildMatch contractors. \
Given a contractor's reliability score breakdown, write an encouraging, specific \
explanation and 3 actionable improvement tips. Be honest but constructive. \
Respond ONLY with valid JSON: { "explanation": string, "improvementTips": string[] }`;

const STATIC_EXPLANATION =
  'Complete more jobs to build your reliability score. Scores improve with consistent on-time delivery.';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  responseRate:      number;   // 0–25
  onTimeCompletion:  number;   // 0–25
  bidAccuracy:       number;   // 0–20
  jobCompletion:     number;   // 0–20
  disputeHistory:    number;   // 0–10
}

export interface ReliabilityScoreResult {
  totalScore:      number;
  breakdown:       ScoreBreakdown;
  explanation:     string;
  improvementTips: string[];
}

// ── Zod schema for AI response ────────────────────────────────────────────────

const AiResponseSchema = z.object({
  explanation:     z.string(),
  improvementTips: z.array(z.string()).min(1).max(5),
});

// ── Component 1: Response rate (0–25 pts) ─────────────────────────────────────

async function scoreResponseRate(contractorUserId: string): Promise<number> {
  const conversations = await prisma.conversation.findMany({
    where:   { contractorId: contractorUserId },
    include: { convMessages: { orderBy: { createdAt: 'asc' } } },
  });

  const responseTimes: number[] = [];

  for (const conv of conversations) {
    const msgs = conv.convMessages;
    for (let i = 0; i < msgs.length - 1; i++) {
      // Only look at messages NOT sent by the contractor (i.e. investor messages)
      if (msgs[i].senderId === contractorUserId) continue;
      // Find the next reply from the contractor
      const reply = msgs.slice(i + 1).find((m) => m.senderId === contractorUserId);
      if (reply) {
        const hours = (reply.createdAt.getTime() - msgs[i].createdAt.getTime()) / 3_600_000;
        responseTimes.push(hours);
      }
    }
  }

  if (responseTimes.length === 0) return 12; // neutral — no data

  const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  return 25 * (1 - Math.min(avg / 48, 1));
}

// ── Component 2: On-time milestone completion (0–25 pts) ──────────────────────

async function scoreOnTimeCompletion(contractorUserId: string): Promise<number> {
  const escrows = await prisma.escrowPayment.findMany({
    where:   { contractorId: contractorUserId },
    include: { milestones: true },
  });

  let total  = 0;
  let onTime = 0;

  for (const ep of escrows) {
    for (const m of ep.milestones) {
      // Only milestones that have reached a terminal state count
      if (m.status === 'RELEASED' || m.status === 'APPROVED') {
        total++;
        onTime++;
      } else if (m.status === 'DISPUTED') {
        total++;
        // DISPUTED = not on time / not delivered cleanly
      }
      // PENDING / IN_PROGRESS / SUBMITTED — still in flight, skip
    }
  }

  if (total === 0) return 12; // neutral — no data
  return 25 * (onTime / total);
}

// ── Component 3: Bid accuracy (0–20 pts) ─────────────────────────────────────

async function scoreBidAccuracy(contractorUserId: string): Promise<number> {
  const acceptedBids = await prisma.bid.findMany({
    where:  { contractorId: contractorUserId, status: 'ACCEPTED' },
    include: {
      job: { select: { status: true } },
    },
  });

  const completedBids = acceptedBids.filter((b) => b.job.status === 'COMPLETED');
  if (completedBids.length === 0) return 10; // neutral — no data

  const deltas: number[] = [];

  for (const bid of completedBids) {
    const escrow = await prisma.escrowPayment.findUnique({
      where:   { jobId: bid.jobId },
      include: { milestones: { where: { status: 'RELEASED' } } },
    });
    if (!escrow || escrow.milestones.length === 0) continue;

    const finalPaid = escrow.milestones.reduce((sum, m) => sum + m.amount, 0);
    const deltaPct  = Math.abs(finalPaid - bid.amount) / bid.amount * 100;
    deltas.push(deltaPct);
  }

  if (deltas.length === 0) return 10;
  const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return 20 * (1 - Math.min(avgDelta / 30, 1));
}

// ── Component 4: Job completion rate (0–20 pts) ───────────────────────────────

async function scoreJobCompletion(contractorUserId: string): Promise<number> {
  const acceptedBids = await prisma.bid.findMany({
    where:   { contractorId: contractorUserId, status: 'ACCEPTED' },
    include: { job: { select: { status: true } } },
  });

  if (acceptedBids.length === 0) return 10; // neutral — no data

  const completed = acceptedBids.filter((b) => b.job.status === 'COMPLETED').length;
  // Abandoned = bid was accepted but job ended up CANCELLED (returned to open is not possible in current model)
  const abandoned  = acceptedBids.filter((b) => b.job.status === 'CANCELLED').length;
  const denominator = completed + abandoned;

  if (denominator === 0) return 10;
  return 20 * (completed / denominator);
}

// ── Component 5: Dispute history (0–10 pts) ───────────────────────────────────

async function scoreDisputeHistory(contractorUserId: string): Promise<number> {
  const escrows = await prisma.escrowPayment.findMany({
    where:  { contractorId: contractorUserId },
    select: { status: true },
  });

  const totalDisputes = escrows.filter(
    (ep) => ep.status === 'DISPUTED' || ep.status === 'REFUNDED',
  ).length;

  if (totalDisputes === 0) return 10; // full points — clean record

  // Refunded = investor got money back = dispute ruled against contractor
  const losses          = escrows.filter((ep) => ep.status === 'REFUNDED').length;
  const disputeLossRate = losses / totalDisputes;
  return 10 * (1 - disputeLossRate);
}

// ── AI explanation generation ─────────────────────────────────────────────────

async function generateExplanation(
  breakdown:       ScoreBreakdown,
  completedJobCount: number,
  contractorUserId: string,
): Promise<{ explanation: string; improvementTips: string[] }> {
  if (completedJobCount < 3) {
    return {
      explanation:     STATIC_EXPLANATION,
      improvementTips: [
        'Complete your first few jobs to establish a track record.',
        'Respond to investor messages within a few hours to build rapport.',
        'Deliver work that matches your bid amount to build trust.',
      ],
    };
  }

  const startMs = Date.now();

  try {
    const response = await anthropicClient.messages.create({
      model:      MODEL,
      max_tokens: 400,
      system:     SYSTEM_PROMPT,
      messages:   [{
        role:    'user',
        content: JSON.stringify({ breakdown, completedJobCount }),
      }],
    });
    const latencyMs = Date.now() - startMs;

    await logAiUsage({
      feature:      FEATURE,
      userId:       contractorUserId,
      model:        MODEL,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      success:      true,
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected content block type');

    const parsed = AiResponseSchema.safeParse(JSON.parse(block.text));
    if (!parsed.success) {
      console.error('[reliability-score] Zod validation failed:', parsed.error.issues);
      throw new Error('AI response failed schema validation');
    }

    return {
      explanation:     parsed.data.explanation,
      improvementTips: parsed.data.improvementTips.slice(0, 3),
    };
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    console.error('[reliability-score] Anthropic error:', err);

    logAiUsage({
      feature:      FEATURE,
      userId:       contractorUserId,
      model:        MODEL,
      inputTokens:  0,
      outputTokens: 0,
      latencyMs,
      success:      false,
      errorMsg:     err instanceof Error ? err.message : 'Unknown error',
    }).catch(() => {});

    // Static fallback — score is still valid
    return {
      explanation:     STATIC_EXPLANATION,
      improvementTips: [
        'Respond to messages quickly to improve your response rate.',
        'Ensure final costs stay close to your bid amount.',
        'Complete all job milestones on time to avoid disputes.',
      ],
    };
  }
}

// ── Main export: single contractor ────────────────────────────────────────────

export async function computeReliabilityScore(
  contractorUserId: string,
): Promise<ReliabilityScoreResult> {
  const [
    responseRate,
    onTimeCompletion,
    bidAccuracy,
    jobCompletion,
    disputeHistory,
  ] = await Promise.all([
    scoreResponseRate(contractorUserId),
    scoreOnTimeCompletion(contractorUserId),
    scoreBidAccuracy(contractorUserId),
    scoreJobCompletion(contractorUserId),
    scoreDisputeHistory(contractorUserId),
  ]);

  const breakdown: ScoreBreakdown = {
    responseRate:     Math.round(responseRate     * 10) / 10,
    onTimeCompletion: Math.round(onTimeCompletion * 10) / 10,
    bidAccuracy:      Math.round(bidAccuracy      * 10) / 10,
    jobCompletion:    Math.round(jobCompletion    * 10) / 10,
    disputeHistory:   Math.round(disputeHistory   * 10) / 10,
  };

  const totalScore = Math.round(
    responseRate + onTimeCompletion + bidAccuracy + jobCompletion + disputeHistory,
  );

  // Count completed jobs to decide whether AI explanation is warranted
  const completedJobCount = await prisma.bid.count({
    where: {
      contractorId: contractorUserId,
      status:       'ACCEPTED',
      job:          { status: 'COMPLETED' },
    },
  });

  const { explanation, improvementTips } = await generateExplanation(
    breakdown, completedJobCount, contractorUserId,
  );

  return { totalScore, breakdown, explanation, improvementTips };
}

// ── Batch export: all active contractors ──────────────────────────────────────

const BATCH_SIZE = 10;

export async function computeAllReliabilityScores(): Promise<void> {
  const startMs = Date.now();
  console.log('[reliability-score] Starting batch computation…');

  const profiles = await prisma.contractorProfile.findMany({
    where:  { user: { isActive: true } },
    select: { userId: true },
  });

  const userIds  = profiles.map((p) => p.userId);
  let succeeded  = 0;
  let failed     = 0;

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (userId) => {
      try {
        const result = await computeReliabilityScore(userId);

        // Update the live reliability_score on contractor profile
        await prisma.contractorProfile.update({
          where: { userId },
          data:  { reliabilityScore: result.totalScore },
        });

        // Upsert detailed breakdown for display / auditing
        const flat = {
          totalScore:        result.totalScore,
          responseRatePts:   result.breakdown.responseRate,
          onTimePts:         result.breakdown.onTimeCompletion,
          bidAccuracyPts:    result.breakdown.bidAccuracy,
          jobCompletionPts:  result.breakdown.jobCompletion,
          disputeHistoryPts: result.breakdown.disputeHistory,
          explanation:       result.explanation,
          improvementTips:   result.improvementTips,
        };
        await prisma.contractorScoreDetails.upsert({
          where:  { contractorUserId: userId },
          create: { contractorUserId: userId, ...flat },
          update: { ...flat, computedAt: new Date() },
        });

        succeeded++;
      } catch (err) {
        failed++;
        console.error(`[reliability-score] Failed for userId=${userId}:`, err);
      }
    }));

    console.log(`[reliability-score] Batch ${Math.ceil((i + BATCH_SIZE) / BATCH_SIZE)} done — ${Math.min(i + BATCH_SIZE, userIds.length)}/${userIds.length}`);
  }

  const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(
    `[reliability-score] Complete — ${succeeded} succeeded, ${failed} failed, ${elapsedSec}s elapsed`,
  );
}
