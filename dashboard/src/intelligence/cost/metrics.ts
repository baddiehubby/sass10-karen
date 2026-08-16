/**
 * Internal intelligence cost / quality observability.
 * Never expose provider infrastructure or raw counters to end users.
 *
 * Target tracked: ZERO MARGINAL AI INFERENCE COST for the core experience.
 * This does NOT mean zero infra (DB, bandwidth, email, monitoring, storage).
 */

import type { CostRouteTier } from "@/src/intelligence/cost/routing";

type ResolutionRecord = {
  tier: CostRouteTier;
  latencyMs: number;
  error: boolean;
  providerFailure: boolean;
  estimatedCostUsd: number;
  cached: boolean;
  local: boolean;
  confidence: number;
  advancedRoute: boolean;
  fallback: boolean;
  coalesced: boolean;
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
  /** Local Soul / lightweight path (no external inference). */
  local?: boolean;
  confidence?: number;
  /** Observability: composer flagged genuine insufficiency — not an auto-spend trigger. */
  advancedRoute?: boolean;
  /** Soft abuse / circuit / suppressed escalation path. */
  fallback?: boolean;
  coalesced?: boolean;
}): void {
  const tier = input.tier;
  const local =
    input.local ?? (tier === "soul_engine" || tier === "local_lightweight");
  samples.push({
    tier,
    latencyMs: Math.max(0, input.latencyMs),
    error: Boolean(input.error),
    providerFailure: Boolean(input.providerFailure),
    estimatedCostUsd: Math.max(0, input.estimatedCostUsd ?? 0),
    cached: Boolean(input.cached),
    local,
    confidence: clamp01(input.confidence ?? (local ? 0.9 : 0.5)),
    advancedRoute: Boolean(input.advancedRoute),
    fallback: Boolean(input.fallback),
    coalesced: Boolean(input.coalesced),
    at: Date.now(),
  });
  if (samples.length > MAX_SAMPLES) samples.shift();
  if (input.userScope) activeUsers.add(input.userScope.slice(0, 80));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export type IntelligenceCostSnapshot = {
  /** Primary product claim metrics (internal). */
  local_responses: number;
  local_confidence: number;
  advanced_route_count: number;
  fallback_count: number;
  estimated_external_cost: number;

  /** Legacy / supporting rates. */
  local_resolution_rate: number;
  external_resolution_rate: number;
  average_latency: number;
  error_rate: number;
  provider_failure_rate: number;
  estimated_cost_per_active_user: number;
  sample_count: number;
  cache_hit_rate: number;
  coalesce_hit_rate: number;
};

export function getIntelligenceCostSnapshot(): IntelligenceCostSnapshot {
  const n = samples.length || 1;
  const localSamples = samples.filter((s) => s.local);
  const local = localSamples.length;
  const external = samples.filter(
    (s) => s.tier === "user_authorized" || s.tier === "fallback_required",
  ).length;
  const errors = samples.filter((s) => s.error).length;
  const providerFails = samples.filter((s) => s.providerFailure).length;
  const latencySum = samples.reduce((a, s) => a + s.latencyMs, 0);
  const costSum = samples.reduce((a, s) => a + s.estimatedCostUsd, 0);
  const cacheHits = samples.filter((s) => s.cached).length;
  const coalesceHits = samples.filter((s) => s.coalesced).length;
  const advanced = samples.filter((s) => s.advancedRoute).length;
  const fallbacks = samples.filter((s) => s.fallback).length;
  const confSum = localSamples.reduce((a, s) => a + s.confidence, 0);
  const users = Math.max(1, activeUsers.size);

  return {
    local_responses: local,
    local_confidence: localSamples.length ? confSum / localSamples.length : 0,
    advanced_route_count: advanced,
    fallback_count: fallbacks,
    estimated_external_cost: costSum,

    local_resolution_rate: local / n,
    external_resolution_rate: external / n,
    average_latency: latencySum / n,
    error_rate: errors / n,
    provider_failure_rate: providerFails / n,
    estimated_cost_per_active_user: costSum / users,
    sample_count: samples.length,
    cache_hit_rate: cacheHits / n,
    coalesce_hit_rate: coalesceHits / n,
  };
}

export function resetIntelligenceMetrics(): void {
  samples.length = 0;
  activeUsers.clear();
}
