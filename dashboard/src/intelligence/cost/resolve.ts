/**
 * Cost-aware intelligence resolver.
 * Priority: Soul Engine → local lightweight → user-authorized → fallback only if required.
 * Never degrades UX solely for an arbitrary cost target — local path is premium.
 *
 * Core experience target: ZERO MARGINAL AI INFERENCE COST
 * (infra/DB/bandwidth are separate and not claimed as zero).
 */

import {
  checkIntelligenceAbuse,
  getProviderTimeoutMs,
  isProviderCircuitOpen,
  recordProviderFailure,
  recordProviderSuccess,
} from "@/src/intelligence/cost/abuse";
import {
  buildUserCacheKey,
  getDeterministicCache,
  setDeterministicCache,
} from "@/src/intelligence/cost/cache";
import { coalesceSync } from "@/src/intelligence/cost/coalesce";
import { minimizeIntelligenceContext } from "@/src/intelligence/cost/context-minimize";
import { recordIntelligenceResolution } from "@/src/intelligence/cost/metrics";
import {
  assessGenuineExternalNeed,
  isUserAuthorizedIntelligenceEnabled,
  selectCostRoute,
  type CostRouteDecision,
  type CostRouteTier,
} from "@/src/intelligence/cost/routing";
import { summarizeMemoriesLocally } from "@/src/intelligence/memory/summarize-local";
import { routeSemantic } from "@/src/intelligence/semantic-router";
import { runSoulEngine } from "@/src/intelligence/soul-engine/run";
import { sanitizeUserText } from "@/src/intelligence/safety";
import {
  isConversationalRepair,
  isRepeatQuestion,
} from "@/src/intelligence/conversation-state";
import type { IntelligenceInput, IntelligenceResult } from "@/src/intelligence/types";

export type CostAwareInput = IntelligenceInput & {
  /** Stable user or session scope for cache + rate limits — never a shared global key. */
  userScope?: string;
  clientIp?: string | null;
  externalRetryCount?: number;
  /** Force skip cache (tests / sensitive flows). */
  skipCache?: boolean;
  /** Ops-only: product-approved capability gap (default false). */
  explicitApprovedExternalGap?: boolean;
};

export type CostAwareResult = IntelligenceResult & {
  cost: {
    tier: CostRouteTier;
    decision: CostRouteDecision;
    cached: boolean;
    coalesced: boolean;
    latencyMs: number;
    estimatedCostUsd: number;
  };
};

/**
 * Authorized remote adapter hook — intentionally a no-op until a real provider is configured.
 * Must never be invoked for never-expensive intents.
 * Must never accept user-posted API keys (see credential-policy).
 */
export type AuthorizedIntelligenceProvider = {
  complete: (input: {
    userText: string;
    timeoutMs: number;
  }) => Promise<{ text: string } | null>;
};

let authorizedProvider: AuthorizedIntelligenceProvider | null = null;

export function setAuthorizedIntelligenceProvider(provider: AuthorizedIntelligenceProvider | null): void {
  authorizedProvider = provider;
}

export function resolveIntelligence(input: CostAwareInput): CostAwareResult {
  const started = nowMs();
  const userScope = input.userScope?.trim() || "session:anon";
  const rawText = sanitizeUserText(input.userText ?? "");

  const abuse = checkIntelligenceAbuse({
    userId: userScope,
    clientIp: input.clientIp,
    text: rawText,
    conversationDepth: input.conversationDepth,
    recentTurnCount: input.recentTurns?.length,
    externalRetryCount: input.externalRetryCount,
  });

  if (!abuse.ok) {
    const soft = softAbuseResult(abuse.softMessage, input, rawText);
    const latencyMs = nowMs() - started;
    const out: CostAwareResult = {
      ...soft,
      cost: {
        tier: "soul_engine",
        decision: {
          tier: "soul_engine",
          neverExpensive: true,
          reason: `abuse_${abuse.code}`,
          cacheSafe: false,
          mayEscalate: false,
        },
        cached: false,
        coalesced: false,
        latencyMs,
        estimatedCostUsd: 0,
      },
    };
    emitMetrics(out, userScope, { fallback: true });
    return out;
  }

  const minimized = minimizeIntelligenceContext({
    userText: rawText,
    recentTurns: input.recentTurns,
    responseHistory: input.responseHistory,
    recentFamilies: input.recentFamilies,
    memoryContext: input.memoryContext,
    persistedMemories: input.persistedMemories,
  });
  const memorySummary = summarizeMemoriesLocally(minimized.persistedMemories);
  const slimInput: CostAwareInput = {
    ...input,
    userText: minimized.userText,
    recentTurns: minimized.recentTurns,
    responseHistory: minimized.responseHistory,
    recentFamilies: minimized.recentFamilies,
    memoryContext: minimized.memoryContext,
    persistedMemories: memorySummary.retained,
  };

  // Cache before coalesce so safe repeats prefer durable user-scoped cache over
  // short-lived same-tick coalescing.
  const early = peekCacheSafe(slimInput, userScope, started);
  if (early) {
    emitMetrics(early, userScope, { fallback: false, coalesced: false });
    return early;
  }

  const { value, coalesced } = coalesceSync(
    {
      userScope,
      userText: minimized.userText,
      voice: input.characterVoice ?? "warm",
      depth: input.conversationDepth ?? 1,
    },
    () => resolveCore(slimInput, userScope, started),
  );

  const latencyMs = nowMs() - started;
  const out: CostAwareResult = {
    ...value,
    cost: { ...value.cost, coalesced, latencyMs },
  };
  emitMetrics(out, userScope, {
    fallback:
      out.cost.decision.reason.includes("suppressed") ||
      out.cost.decision.reason.includes("fallback") ||
      out.cost.decision.reason.startsWith("abuse_"),
    coalesced,
  });
  return out;
}

function peekCacheSafe(
  input: CostAwareInput,
  userScope: string,
  started: number,
): CostAwareResult | null {
  if (input.skipCache) return null;
  const userText = input.userText ?? "";
  const turns = input.recentTurns ?? [];
  const isShort = userText.length > 0 && userText.length <= 12 && !/\?/.test(userText);
  const lastBuddy = [...turns].reverse().find((t) => t.role === "buddy")?.text ?? "";
  const isRepair = isConversationalRepair(userText, lastBuddy);
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
  const decision = selectCostRoute({
    intent: isRepair ? "correction" : hit.intent,
    userText,
    conversationDepth: input.conversationDepth ?? 1,
    isRepeat,
    mayCiteMemory: Boolean(input.persistedMemories?.length),
    userAuthorizedEnabled: isUserAuthorizedIntelligenceEnabled(),
    genuineExternalNeed: assessGenuineExternalNeed({
      explicitApprovedGap: input.explicitApprovedExternalGap === true,
    }),
  });
  if (!decision.cacheSafe) return null;
  const key = buildUserCacheKey({
    userScope,
    intent: hit.intent,
    userText,
    voice: input.characterVoice ?? "warm",
    depth: input.conversationDepth ?? 1,
  });
  const cached = getDeterministicCache(key, userScope);
  if (!cached) return null;
  const full = runSoulEngine({ ...input, userText, seed: input.seed ?? `cache:${key}` });
  return {
    ...full,
    text: cached.text,
    response: cached.text,
    familyId: cached.familyId || full.familyId,
    cost: {
      tier: "soul_engine",
      decision,
      cached: true,
      coalesced: false,
      latencyMs: nowMs() - started,
      estimatedCostUsd: 0,
    },
  };
}

function resolveCore(input: CostAwareInput, userScope: string, started: number): CostAwareResult {
  const userText = input.userText ?? "";
  const turns = input.recentTurns ?? [];
  const isShort = userText.length > 0 && userText.length <= 12 && !/\?/.test(userText);
  const lastBuddy = [...turns].reverse().find((t) => t.role === "buddy")?.text ?? "";
  const isRepair = isConversationalRepair(userText, lastBuddy);
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

  const genuineExternalNeed = assessGenuineExternalNeed({
    explicitApprovedGap: input.explicitApprovedExternalGap === true,
  });

  const decision = selectCostRoute({
    intent: isRepair ? "correction" : hit.intent,
    userText,
    conversationDepth: input.conversationDepth ?? 1,
    isRepeat,
    mayCiteMemory: Boolean(input.persistedMemories?.length),
    userAuthorizedEnabled: isUserAuthorizedIntelligenceEnabled(),
    genuineExternalNeed,
  });

  if (!input.skipCache && decision.cacheSafe) {
    const key = buildUserCacheKey({
      userScope,
      intent: hit.intent,
      userText,
      voice: input.characterVoice ?? "warm",
      depth: input.conversationDepth ?? 1,
    });
    const cached = getDeterministicCache(key, userScope);
    if (cached) {
      const full = runSoulEngine({ ...input, userText, seed: input.seed ?? `cache:${key}` });
      return {
        ...full,
        text: cached.text,
        response: cached.text,
        familyId: cached.familyId || full.familyId,
        cost: {
          tier: "soul_engine",
          decision,
          cached: true,
          coalesced: false,
          latencyMs: nowMs() - started,
          estimatedCostUsd: 0,
        },
      };
    }
  }

  if (!decision.mayEscalate || decision.neverExpensive || isProviderCircuitOpen()) {
    const local = runLocal(
      input,
      userText,
      decision.tier === "local_lightweight" ? "local_lightweight" : "soul_engine",
    );
    maybeCache(local, decision, userScope, userText, input);
    return {
      ...local,
      cost: {
        ...local.cost,
        latencyMs: nowMs() - started,
        decision,
        coalesced: false,
      },
    };
  }

  const external = tryAuthorizedSync(userText);
  if (external) {
    const base = runSoulEngine({ ...input, userText });
    recordProviderSuccess();
    return {
      ...base,
      text: external.text,
      response: external.text,
      cost: {
        tier: "user_authorized",
        decision,
        cached: false,
        coalesced: false,
        latencyMs: nowMs() - started,
        estimatedCostUsd: 0.002,
      },
    };
  }

  const local = runLocal(input, userText, "soul_engine");
  return {
    ...local,
    cost: {
      ...local.cost,
      latencyMs: nowMs() - started,
      decision: {
        ...decision,
        reason: "authorized_unavailable_local_fallback",
      },
      coalesced: false,
    },
  };
}

function runLocal(
  input: CostAwareInput,
  userText: string,
  tier: CostRouteTier,
): CostAwareResult {
  const result = runSoulEngine({ ...input, userText });
  return {
    ...result,
    cost: {
      tier,
      decision: {
        tier,
        neverExpensive: true,
        reason: "local",
        cacheSafe: false,
        mayEscalate: false,
      },
      cached: false,
      coalesced: false,
      latencyMs: 0,
      estimatedCostUsd: 0,
    },
  };
}

function maybeCache(
  result: CostAwareResult,
  decision: CostRouteDecision,
  userScope: string,
  userText: string,
  input: CostAwareInput,
): void {
  if (!decision.cacheSafe || result.routed.mayCiteMemory) return;
  const key = buildUserCacheKey({
    userScope,
    intent: result.intent,
    userText,
    voice: input.characterVoice ?? "warm",
    depth: input.conversationDepth ?? 1,
  });
  setDeterministicCache(key, userScope, {
    text: result.text,
    intent: result.intent,
    familyId: result.familyId,
    emotion: result.emotion,
  });
}

function tryAuthorizedSync(userText: string): { text: string } | null {
  if (!authorizedProvider) return null;
  if (isProviderCircuitOpen()) return null;
  void userText;
  void getProviderTimeoutMs;
  return null;
}

/** Async path for future authorized providers — still refuses never-expensive intents. */
export async function resolveIntelligenceAsync(input: CostAwareInput): Promise<CostAwareResult> {
  const started = nowMs();
  const syncFirst = resolveIntelligence({ ...input, skipCache: false });
  if (!syncFirst.cost.decision.mayEscalate || syncFirst.cost.decision.neverExpensive) {
    return syncFirst;
  }
  if (!authorizedProvider || isProviderCircuitOpen()) return syncFirst;

  try {
    const timeout = getProviderTimeoutMs();
    const out = await Promise.race([
      authorizedProvider.complete({
        userText: sanitizeUserText(input.userText ?? ""),
        timeoutMs: timeout,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeout + 50)),
    ]);
    if (!out?.text) {
      recordProviderFailure();
      return resolveIntelligence({ ...input, skipCache: true });
    }
    recordProviderSuccess();
    const base = runSoulEngine({ ...input, userText: sanitizeUserText(input.userText ?? "") });
    const latencyMs = nowMs() - started;
    const result: CostAwareResult = {
      ...base,
      text: out.text,
      response: out.text,
      cost: {
        tier: "user_authorized",
        decision: syncFirst.cost.decision,
        cached: false,
        coalesced: false,
        latencyMs,
        estimatedCostUsd: 0.002,
      },
    };
    emitMetrics(result, input.userScope ?? "session:anon", { fallback: false });
    return result;
  } catch {
    recordProviderFailure();
    return resolveIntelligence({ ...input, skipCache: true });
  }
}

function softAbuseResult(message: string, input: CostAwareInput, userText: string): IntelligenceResult {
  const base = runSoulEngine({
    ...input,
    userText: userText.slice(0, 12) || "…",
    seed: `abuse:${message.slice(0, 24)}`,
  });
  return { ...base, text: message, response: message };
}

function emitMetrics(
  out: CostAwareResult,
  userScope: string,
  flags: { fallback?: boolean; coalesced?: boolean },
): void {
  const local = out.cost.estimatedCostUsd === 0 && out.inference === "none";
  recordIntelligenceResolution({
    tier: out.cost.tier,
    latencyMs: out.cost.latencyMs,
    estimatedCostUsd: out.cost.estimatedCostUsd,
    cached: out.cost.cached,
    userScope,
    local,
    confidence: out.confidence,
    advancedRoute: out.requiresAdvancedIntelligence,
    fallback: Boolean(flags.fallback) || out.cost.decision.reason.includes("fallback"),
    coalesced: flags.coalesced ?? out.cost.coalesced,
  });
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
