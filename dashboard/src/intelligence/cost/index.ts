/**
 * Zero-avoidable-cost engineering — public barrel.
 */

export {
  COST_ROUTE_PRIORITY,
  NEVER_EXPENSIVE_INTENTS,
  isNeverExpensiveIntent,
  looksLikeStaticProductRequest,
  isBasicEmotionalSupport,
  selectCostRoute,
  assessGenuineExternalNeed,
  isUserAuthorizedIntelligenceEnabled,
} from "@/src/intelligence/cost/routing";
export type { CostRouteTier, CostRouteDecision } from "@/src/intelligence/cost/routing";

export {
  buildUserCacheKey,
  getDeterministicCache,
  setDeterministicCache,
  clearDeterministicCache,
  deterministicCacheStats,
} from "@/src/intelligence/cost/cache";

export {
  checkIntelligenceAbuse,
  resetAbuseState,
  recordProviderFailure,
  recordProviderSuccess,
  isProviderCircuitOpen,
  getProviderTimeoutMs,
  ABUSE_LIMITS,
} from "@/src/intelligence/cost/abuse";

export {
  recordIntelligenceResolution,
  getIntelligenceCostSnapshot,
  resetIntelligenceMetrics,
} from "@/src/intelligence/cost/metrics";
export type { IntelligenceCostSnapshot } from "@/src/intelligence/cost/metrics";

export { minimizeIntelligenceContext, CONTEXT_LIMITS } from "@/src/intelligence/cost/context-minimize";
export type { MinimizedContext } from "@/src/intelligence/cost/context-minimize";

export {
  coalesceSync,
  coalesceRequest,
  resetCoalesceState,
  coalesceInflightCount,
} from "@/src/intelligence/cost/coalesce";

export {
  evaluateUserProviderCredential,
  isArbitraryProviderProxyAllowed,
} from "@/src/intelligence/cost/credential-policy";

export { buildInternalCostTelemetry } from "@/src/intelligence/cost/telemetry";
export type { InternalCostTelemetry } from "@/src/intelligence/cost/telemetry";

export {
  resolveIntelligence,
  resolveIntelligenceAsync,
  setAuthorizedIntelligenceProvider,
} from "@/src/intelligence/cost/resolve";
export type { CostAwareInput, CostAwareResult, AuthorizedIntelligenceProvider } from "@/src/intelligence/cost/resolve";
