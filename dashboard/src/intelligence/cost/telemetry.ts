/**
 * Internal cost dashboard / telemetry structure.
 * Never render these fields in ordinary product UI.
 */

import {
  getIntelligenceCostSnapshot,
  type IntelligenceCostSnapshot,
} from "@/src/intelligence/cost/metrics";
import { deterministicCacheStats } from "@/src/intelligence/cost/cache";
import { coalesceInflightCount } from "@/src/intelligence/cost/coalesce";
import { isProviderCircuitOpen, ABUSE_LIMITS } from "@/src/intelligence/cost/abuse";
import { isUserAuthorizedIntelligenceEnabled } from "@/src/intelligence/cost/routing";
import { isArbitraryProviderProxyAllowed } from "@/src/intelligence/cost/credential-policy";

export type InternalCostTelemetry = {
  generatedAt: string;
  /** Explicit product claim scope — not total infra cost. */
  claimScope: "zero_marginal_ai_inference_cost_core_experience";
  disclaimer:
    "Does not include database, bandwidth, email, monitoring, storage, or other infrastructure spend.";
  snapshot: IntelligenceCostSnapshot;
  gates: {
    userAuthorizedIntelligenceEnabled: boolean;
    arbitraryProviderProxyAllowed: false;
    providerCircuitOpen: boolean;
  };
  runtime: {
    cache: { users: number; entries: number };
    coalesceInflight: number;
    abuseLimits: typeof ABUSE_LIMITS;
  };
};

export function buildInternalCostTelemetry(): InternalCostTelemetry {
  return {
    generatedAt: new Date().toISOString(),
    claimScope: "zero_marginal_ai_inference_cost_core_experience",
    disclaimer:
      "Does not include database, bandwidth, email, monitoring, storage, or other infrastructure spend.",
    snapshot: getIntelligenceCostSnapshot(),
    gates: {
      userAuthorizedIntelligenceEnabled: isUserAuthorizedIntelligenceEnabled(),
      arbitraryProviderProxyAllowed: isArbitraryProviderProxyAllowed(),
      providerCircuitOpen: isProviderCircuitOpen(),
    },
    runtime: {
      cache: deterministicCacheStats(),
      coalesceInflight: coalesceInflightCount(),
      abuseLimits: ABUSE_LIMITS,
    },
  };
}
