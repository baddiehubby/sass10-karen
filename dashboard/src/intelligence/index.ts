/**
 * Buddie Core Intelligence Engine — $0 local inference.
 *
 * Pipeline: Character → Conversation State → Memory → Semantic Router → Composer → Orb
 */

export type * from "@/src/intelligence/types";
export { runSoulEngine, localIntelligenceRouter } from "@/src/intelligence/soul-engine/run";
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
} from "@/src/intelligence/variation";
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
