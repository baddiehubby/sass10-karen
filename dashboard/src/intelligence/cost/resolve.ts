/**
 * Cost-aware intelligence resolver.
 * Priority: Soul Engine → local lightweight → user-authorized → fallback only if required.
 * Never degrades UX solely for an arbitrary cost target — local path is premium.
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
import { recordIntelligenceResolution } from "@/src/intelligence/cost/metrics";
import {
  isUserAuthorizedIntelligenceEnabled,
  selectCostRoute,
  type CostRouteDecision,
  type CostRouteTier,
} from "@/src/intelligence/cost/routing";
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
};

export type CostAwareResult = IntelligenceResult & {
  cost: {
    tier: CostRouteTier;
    decision: CostRouteDecision;
    cached: boolean;
    latencyMs: number;
    estimatedCostUsd: number;
  };
};

/**
 * Authorized remote adapter hook — intentionally a no-op until a real provider is configured.
 * Must never be invoked for never-expensive intents.
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
  const userText = sanitizeUserText(input.userText ?? "");

  const abuse = checkIntelligenceAbuse({
    userId: userScope,
    clientIp: input.clientIp,
    text: userText,
    conversationDepth: input.conversationDepth,
    recentTurnCount: input.recentTurns?.length,
    externalRetryCount: input.externalRetryCount,
  });

  if (!abuse.ok) {
    const soft = softAbuseResult(abuse.softMessage, input, userText);
    finishMetrics({
      tier: "soul_engine",
      latencyMs: nowMs() - started,
      error: false,
      estimatedCostUsd: 0,
      cached: false,
      userScope,
    });
    return {
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
        latencyMs: nowMs() - started,
        estimatedCostUsd: 0,
      },
    };
  }

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
    genuineExternalNeed: false, // Soul Engine covers product surface; do not invent need
  });

  // Deterministic user-scoped cache (never shared / never private memory replies)
  if (!input.skipCache && decision.cacheSafe) {
    const key = buildUserCacheKey({
      userScope,
      intent: decision.tier === "soul_engine" ? hit.intent : hit.intent,
      userText,
      voice: input.characterVoice ?? "warm",
      depth: input.conversationDepth ?? 1,
    });
    const cached = getDeterministicCache(key, userScope);
    if (cached) {
      const full = runSoulEngine({ ...input, userText, seed: input.seed ?? `cache:${key}` });
      // Prefer cached wording for identical safe prompts, keep machine fresh
      const merged: CostAwareResult = {
        ...full,
        text: cached.text,
        familyId: cached.familyId || full.familyId,
        cost: {
          tier: "soul_engine",
          decision,
          cached: true,
          latencyMs: nowMs() - started,
          estimatedCostUsd: 0,
        },
      };
      finishMetrics({
        tier: "soul_engine",
        latencyMs: merged.cost.latencyMs,
        cached: true,
        estimatedCostUsd: 0,
        userScope,
      });
      return merged;
    }
  }

  // Never escalate never-expensive / local-preferred
  if (!decision.mayEscalate || decision.neverExpensive || isProviderCircuitOpen()) {
    const local = runLocal(input, userText, decision.tier === "local_lightweight" ? "local_lightweight" : "soul_engine");
    maybeCache(local, decision, userScope, userText, input);
    const latencyMs = nowMs() - started;
    finishMetrics({
      tier: local.cost.tier,
      latencyMs,
      estimatedCostUsd: 0,
      cached: false,
      userScope,
    });
    return { ...local, cost: { ...local.cost, latencyMs, decision } };
  }

  // Authorized path — only when explicitly enabled AND mayEscalate
  // Currently no provider is registered by default → soft local fallback (premium UX preserved)
  const external = tryAuthorizedSync(userText);
  if (external) {
    const base = runSoulEngine({ ...input, userText });
    const latencyMs = nowMs() - started;
    recordProviderSuccess();
    finishMetrics({
      tier: "user_authorized",
      latencyMs,
      estimatedCostUsd: 0.002,
      userScope,
    });
    return {
      ...base,
      text: external.text,
      cost: {
        tier: "user_authorized",
        decision,
        cached: false,
        latencyMs,
        estimatedCostUsd: 0.002,
      },
    };
  }

  const local = runLocal(input, userText, "soul_engine");
  const latencyMs = nowMs() - started;
  finishMetrics({
    tier: "soul_engine",
    latencyMs,
    estimatedCostUsd: 0,
    userScope,
  });
  return { ...local, cost: { ...local.cost, latencyMs, decision } };
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

/**
 * Sync-safe authorized attempt — async providers must register a sync-capable shim
 * or remain null. Never blocks the product on network.
 */
function tryAuthorizedSync(userText: string): { text: string } | null {
  if (!authorizedProvider) return null;
  if (isProviderCircuitOpen()) return null;
  // Provider interface is async; we do not block. Callers needing async should use resolveIntelligenceAsync.
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
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = getProviderTimeoutMs();
    const timer =
      ctrl && typeof setTimeout === "function"
        ? setTimeout(() => ctrl.abort(), timeout)
        : null;
    const out = await Promise.race([
      authorizedProvider.complete({ userText: sanitizeUserText(input.userText ?? ""), timeoutMs: timeout }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeout + 50)),
    ]);
    if (timer) clearTimeout(timer);
    if (!out?.text) {
      recordProviderFailure();
      finishMetrics({
        tier: "soul_engine",
        latencyMs: nowMs() - started,
        providerFailure: true,
        estimatedCostUsd: 0,
        userScope: input.userScope,
      });
      return resolveIntelligence({ ...input, skipCache: true });
    }
    recordProviderSuccess();
    const base = runSoulEngine({ ...input, userText: sanitizeUserText(input.userText ?? "") });
    const latencyMs = nowMs() - started;
    finishMetrics({
      tier: "user_authorized",
      latencyMs,
      estimatedCostUsd: 0.002,
      userScope: input.userScope,
    });
    return {
      ...base,
      text: out.text,
      cost: {
        tier: "user_authorized",
        decision: syncFirst.cost.decision,
        cached: false,
        latencyMs,
        estimatedCostUsd: 0.002,
      },
    };
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
  return { ...base, text: message };
}

function finishMetrics(input: Parameters<typeof recordIntelligenceResolution>[0]): void {
  recordIntelligenceResolution(input);
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
