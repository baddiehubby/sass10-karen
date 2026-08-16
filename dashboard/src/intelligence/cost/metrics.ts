/**
 * Internal intelligence cost / quality observability.
 * Never expose provider infrastructure or raw counters to end users.
 */

import type { CostRouteTier } from "@/src/intelligence/cost/routing";

type ResolutionRecord = {
  tier: CostRouteTier;
  latencyMs: number;
  error: boolean;
  providerFailure: boolean;
  estimatedCostUsd: number;
  cached: boolean;
  at: number;
};

const MAX_SAMPLES = 500;
const samples: ResolutionRecord[] = [];
const activeUsers = new Set<string>();

export function recordIntelligenceResolution(input: {
  tier: CostRouteTier;
  latencyMs: number;
  error?: boolean;
  providerFailure?: boolean;
  estimatedCostUsd?: number;
  cached?: boolean;
  userScope?: string;
}): void {
  samples.push({
    tier: input.tier,
    latencyMs: Math.max(0, input.latencyMs),
    error: Boolean(input.error),
    providerFailure: Boolean(input.providerFailure),
    estimatedCostUsd: Math.max(0, input.estimatedCostUsd ?? 0),
    cached: Boolean(input.cached),
    at: Date.now(),
  });
  if (samples.length > MAX_SAMPLES) samples.shift();
  if (input.userScope) activeUsers.add(input.userScope.slice(0, 80));
}

export type IntelligenceCostSnapshot = {
  local_resolution_rate: number;
  external_resolution_rate: number;
  average_latency: number;
  error_rate: number;
  provider_failure_rate: number;
  estimated_cost_per_active_user: number;
  sample_count: number;
  cache_hit_rate: number;
};

export function getIntelligenceCostSnapshot(): IntelligenceCostSnapshot {
  const n = samples.length || 1;
  const local = samples.filter((s) => s.tier === "soul_engine" || s.tier === "local_lightweight").length;
  const external = samples.filter(
    (s) => s.tier === "user_authorized" || s.tier === "fallback_required",
  ).length;
  const errors = samples.filter((s) => s.error).length;
  const providerFails = samples.filter((s) => s.providerFailure).length;
  const latencySum = samples.reduce((a, s) => a + s.latencyMs, 0);
  const costSum = samples.reduce((a, s) => a + s.estimatedCostUsd, 0);
  const cacheHits = samples.filter((s) => s.cached).length;
  const users = Math.max(1, activeUsers.size);

  return {
    local_resolution_rate: local / n,
    external_resolution_rate: external / n,
    average_latency: latencySum / n,
    error_rate: errors / n,
    provider_failure_rate: providerFails / n,
    estimated_cost_per_active_user: costSum / users,
    sample_count: samples.length,
    cache_hit_rate: cacheHits / n,
  };
}

export function resetIntelligenceMetrics(): void {
  samples.length = 0;
  activeUsers.clear();
}
