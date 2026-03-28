import prisma from '../../lib/prisma';

interface LogAiUsageParams {
  feature: string;
  userId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorMsg?: string;
}

export async function logAiUsage(params: LogAiUsageParams): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: {
        feature:      params.feature,
        userId:       params.userId ?? null,
        model:        params.model,
        inputTokens:  params.inputTokens,
        outputTokens: params.outputTokens,
        latencyMs:    params.latencyMs,
        success:      params.success,
        errorMsg:     params.errorMsg ?? null,
      },
    });
  } catch (err) {
    console.error('[ai-logger] Failed to write usage log:', err);
    // Never throw — logging must not break the calling feature
  }
}
