/**
 * Soul Engine entry — local intelligence router pipeline.
 * User → Character → Conversation State → Memory → Router → Composer → Orb cue
 * No external inference.
 */

import {
  advanceMachine,
  buildConversationState,
  computeContinuity,
  computeNovelty,
  isConversationalRepair,
  isRepeatQuestion,
  toInternalTurn,
} from "@/src/intelligence/conversation-state";
import { advanceTopic, createTopicState, resolveTopic } from "@/src/intelligence/conversation-state/topic-machine";
import {
  applyAdaptiveEnrichment,
  composerCapsFromRuntime,
  getAdaptiveRuntime,
} from "@/src/intelligence/adaptive/runtime";
import { extractMemoryCandidates, selectMemoryContext } from "@/src/intelligence/memory";
import { composeResponse } from "@/src/intelligence/response-composer";
import { sanitizeUserText } from "@/src/intelligence/safety";
import { normalizeEmotion, routeSemantic } from "@/src/intelligence/semantic-router";
import { emotionFromSoul, soulFromVoice } from "@/src/intelligence/soul-engine";
import { createVariationState, recordVariation } from "@/src/intelligence/variation";
import type {
  IntelligenceInput,
  IntelligenceResult,
  RoutedContext,
} from "@/src/intelligence/types";

export function runSoulEngine(input: IntelligenceInput): IntelligenceResult {
  void getAdaptiveRuntime();
  const device = composerCapsFromRuntime(input.device);
  const userText = sanitizeUserText(input.userText ?? "");
  const turns = input.recentTurns ?? [];
  const conv = buildConversationState(turns, input.conversationDepth);
  const isShort = userText.length > 0 && userText.length <= 12 && !/\?/.test(userText);
  const isRepair = isConversationalRepair(userText, conv.lastBuddyText);
  const isRepeat = isRepeatQuestion(userText, turns);

  const previousTopic = input.previousMachine?.topic ?? input.recentTopics?.[input.recentTopics.length - 1];
  const previousUserTexts = turns.filter((t) => t.role === "user").map((t) => t.text).slice(-6);

  const hit = routeSemantic(userText, {
    isRepair,
    isRepeat,
    isShort,
    previousTopic,
    previousMessages: previousUserTexts,
  });

  let emotion = normalizeEmotion(hit.emotion);
  const soul = soulFromVoice(input.characterVoice ?? "warm");
  emotion = emotionFromSoul(emotion, soul);

  let topicState = createTopicState(previousTopic ?? "none");
  topicState = advanceTopic(topicState, hit.topic, conv.depth);
  const topic = resolveTopic(hit.topic, topicState);
  const subtopic = hit.subtopic ?? hit.entity.concern ?? null;

  const memoryContext = selectMemoryContext(input.memoryContext ?? [], userText);
  const persistedMemories = input.persistedMemories ?? [];
  const { persist: memoryToPersist, reject: memoryRejected } = extractMemoryCandidates({
    userText,
    entity: hit.entity,
    topic,
    intent: hit.intent,
  });

  const continuity = computeContinuity(
    previousTopic,
    topic,
    input.previousMachine?.userIntent,
    hit.intent,
  );
  const novelty = computeNovelty(userText, previousUserTexts);
  const seed = input.seed ?? `${userText}|${conv.depth}|${hit.intent}|${novelty.toFixed(2)}`;

  const intent = isRepair ? "correction" : hit.intent;
  const mayCiteMemory =
    persistedMemories.length > 0 &&
    (intent === "memory_reference" || (conv.depth >= 3 && novelty < 0.5));

  const recentFamilies = [
    ...(input.previousMachine?.recentResponseFamilies ?? []),
    ...(input.recentFamilies ?? []),
  ].slice(-12);

  const routed: RoutedContext = {
    intent,
    emotion,
    topic,
    subtopic,
    depth: conv.depth,
    confidence: hit.confidence,
    continuity,
    novelty,
    memoryContext,
    persistedMemories,
    responseHistory: input.responseHistory ?? [],
    recentFamilies,
    characterVoice: input.characterVoice ?? "warm",
    companionName: input.companionName ?? "Buddy",
    userText,
    isRepeat,
    isCorrection: isRepair,
    isShort,
    seed,
    entity: hit.entity,
    engagementState: input.previousMachine?.engagementState ?? "opening",
    mayCiteMemory,
    signals: hit.signals,
  };

  // Derive engagement before compose for follow-up gating
  routed.engagementState =
    conv.depth <= 2 ? "opening" : conv.depth <= 5 ? "warming" : "deep";
  if (isRepair) routed.engagementState = "repairing";
  if (intent === "farewell") routed.engagementState = "closing";
  if (intent === "silence" || intent === "short_answer") routed.engagementState = "quiet";

  const composed = composeResponse(routed, device);
  const text = applyAdaptiveEnrichment(composed.text, seed);

  const variation = recordVariation(
    createVariationState({
      recentFamilies: routed.recentFamilies,
      recentWording: routed.responseHistory,
      lastTone: routed.emotion,
    }),
    composed.familyId,
    text,
    composed.emotion,
  );

  const conversation = advanceMachine({
    previous: input.previousMachine,
    conversationId: input.conversationId ?? input.previousMachine?.conversationId,
    topic,
    subtopic,
    emotion,
    intent,
    depth: conv.depth,
    userText,
    buddyText: text,
    familyId: composed.familyId,
    memoryRefs: mayCiteMemory ? persistedMemories.map((m) => m.subject) : [],
    isCorrection: isRepair,
  });

  const turn = toInternalTurn({
    topic,
    intent,
    emotion,
    depth: conv.depth,
    continuity,
    novelty,
    confidence: hit.confidence,
  });

  return {
    ...composed,
    text,
    response: text,
    confidence: hit.confidence,
    emotionalTone: emotion,
    requiresAdvancedIntelligence: composed.requiresAdvancedIntelligence,
    routed: {
      ...routed,
      recentFamilies: variation.recentFamilies,
      responseHistory: [...routed.responseHistory, text].slice(-12),
    },
    conversation,
    turn,
    memoryToPersist,
    memoryRejected,
    memoryCandidates: [...memoryToPersist, ...memoryRejected],
  };
}

/** Alias matching architecture name. */
export const localIntelligenceRouter = runSoulEngine;
