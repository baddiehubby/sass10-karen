/**
 * Buddie Core Intelligence Engine — $0 local inference.
 *
 * Pipeline: Character → Conversation State → Memory → Semantic Router → Composer → Orb
 */

export type * from "@/src/intelligence/types";
export { runSoulEngine, localIntelligenceRouter } from "@/src/intelligence/soul-engine/run";
export {
  assembleFromPrimitives,
  RESPONSE_DEDUP_WINDOW,
  pickPrimitive,
} from "@/src/intelligence/soul-engine/primitives";
export { routeSemantic } from "@/src/intelligence/semantic-router";
export { composeResponse } from "@/src/intelligence/response-composer";
export {
  selectMemoryContext,
  memoryHintLine,
  extractMemoryCandidates,
  MEMORY_PERSIST_THRESHOLD,
} from "@/src/intelligence/memory";
export {
  buildConversationState,
  isConversationalRepair,
  isMemoryForgetRequest,
  isRepeatQuestion,
  advanceMachine,
  computeContinuity,
  computeNovelty,
} from "@/src/intelligence/conversation-state";
export { createTopicState, advanceTopic, resolveTopic } from "@/src/intelligence/conversation-state/topic-machine";
export { soulFromVoice } from "@/src/intelligence/soul-engine";
export {
  createVariationState,
  chooseFamily,
  avoidRepeatText,
  wordingSimilarity,
  isTooSimilar,
  responseFingerprint,
  fingerprintCollision,
} from "@/src/intelligence/variation";
export { contradictsPrevious } from "@/src/intelligence/semantic-router";
export { detectsCrisisLanguage, sanitizeUserText } from "@/src/intelligence/safety";
export {
  defaultDeviceCapabilities,
  detectCapabilityProfile,
  resolveIntelligenceStrategy,
  publicInternalFlags,
  preferredResponseLength,
} from "@/src/intelligence/device-capabilities";
export type { CapabilityProfile, IntelligenceStrategy } from "@/src/intelligence/device-capabilities";
export {
  getAdaptiveRuntime,
  startAdaptiveIntelligenceWarmup,
  scheduleIdleWarmup,
} from "@/src/intelligence/adaptive/runtime";
export {
  resolveIntelligence,
  selectCostRoute,
  isNeverExpensiveIntent,
  NEVER_EXPENSIVE_INTENTS,
  getIntelligenceCostSnapshot,
  checkIntelligenceAbuse,
  clearDeterministicCache,
  resetAbuseState,
  resetIntelligenceMetrics,
  ABUSE_LIMITS,
} from "@/src/intelligence/cost";
export type {
  CostRouteTier,
  CostRouteDecision,
  CostAwareResult,
  IntelligenceCostSnapshot,
} from "@/src/intelligence/cost";
