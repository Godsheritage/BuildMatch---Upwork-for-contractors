// Shared TypeScript types for all AI features
// Add to this file as new features are built

export interface AiServiceError extends Error {
  feature: string;
  isRetryable: boolean;
}

export interface AiUsageLog {
  feature: string;
  userId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorMsg?: string;
}

// Re-export all feature-specific types
export type { MatchedContractor, MatchingResult } from '../services/ai/matching.service';
export type { GeneratedContract } from '../services/ai/contract-generator.service';
export type { ReliabilityScoreResult } from '../services/ai/reliability-score.service';
export type { ScopeEstimate } from '../services/ai/scope-estimator.service';
