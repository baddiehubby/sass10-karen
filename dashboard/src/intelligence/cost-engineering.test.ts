import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { baseInput } from "@/src/intelligence/__fixtures__/intents";
import {
  ABUSE_LIMITS,
  NEVER_EXPENSIVE_INTENTS,
  checkIntelligenceAbuse,
  clearDeterministicCache,
  getIntelligenceCostSnapshot,
  isNeverExpensiveIntent,
  looksLikeStaticProductRequest,
  resetAbuseState,
  resetIntelligenceMetrics,
  resolveIntelligence,
  selectCostRoute,
  setAuthorizedIntelligenceProvider,
  recordProviderFailure,
  isProviderCircuitOpen,
} from "@/src/intelligence/cost";
import { buddyReplyFull } from "@/lib/buddy-intelligence";

describe("cost routing priority", () => {
  beforeEach(() => {
    resetAbuseState();
    resetIntelligenceMetrics();
    clearDeterministicCache();
    setAuthorizedIntelligenceProvider(null);
  });

  it("forces soul engine for never-expensive intents", () => {
    for (const intent of NEVER_EXPENSIVE_INTENTS) {
      const d = selectCostRoute({
        intent,
        userText: "hi",
        conversationDepth: 1,
        genuineExternalNeed: true,
        userAuthorizedEnabled: true,
      });
      assert.equal(d.tier, "soul_engine");
      assert.equal(d.mayEscalate, false);
      assert.equal(d.neverExpensive, true);
    }
  });

  it("never escalates greetings / orb / settings / subscription questions", () => {
    const cases = [
      { text: "hey", intent: "greeting" as const },
      { text: "[orb_touch]", intent: "orb_touch" as const },
      { text: "what is my subscription plan", intent: "smalltalk" as const },
      { text: "open settings", intent: "smalltalk" as const },
    ];
    for (const c of cases) {
      const staticHit = looksLikeStaticProductRequest(c.text);
      const d = selectCostRoute({
        intent: c.intent,
        userText: c.text,
        conversationDepth: 1,
        genuineExternalNeed: true,
        userAuthorizedEnabled: true,
      });
      assert.equal(d.mayEscalate, false, c.text);
      assert.ok(d.neverExpensive || staticHit || isNeverExpensiveIntent(c.intent));
    }
  });

  it("prefers local composition over fallback even when need is claimed", () => {
    const d = selectCostRoute({
      intent: "goals",
      userText: "help me plan my year",
      conversationDepth: 4,
      genuineExternalNeed: false,
      userAuthorizedEnabled: true,
    });
    assert.equal(d.tier, "local_lightweight");
    assert.equal(d.mayEscalate, false);
  });

  it("resolves product replies at $0 with inference none", () => {
    const out = resolveIntelligence({
      ...baseInput({ userText: "hey", seed: "cost-hi" }),
      userScope: "user:test-a",
    });
    assert.equal(out.inference, "none");
    assert.equal(out.source, "local-intelligence");
    assert.equal(out.cost.estimatedCostUsd, 0);
    assert.ok(out.cost.tier === "soul_engine" || out.cost.tier === "local_lightweight");
    assert.equal(out.cost.decision.mayEscalate, false);
  });
});

describe("user-scoped deterministic cache", () => {
  beforeEach(() => {
    resetAbuseState();
    resetIntelligenceMetrics();
    clearDeterministicCache();
  });

  it("caches safe greetings per user and does not share across users", () => {
    const a1 = resolveIntelligence({
      ...baseInput({ userText: "hey", seed: "cache-a1", characterVoice: "warm", conversationDepth: 1 }),
      userScope: "user:alice",
    });
    const a2 = resolveIntelligence({
      ...baseInput({ userText: "hey", seed: "cache-a2", characterVoice: "warm", conversationDepth: 1 }),
      userScope: "user:alice",
    });
    assert.equal(a1.cost.cached, false);
    assert.equal(a2.cost.cached, true);
    assert.equal(a2.text, a1.text);

    const b1 = resolveIntelligence({
      ...baseInput({ userText: "hey", seed: "cache-b1", characterVoice: "warm", conversationDepth: 1 }),
      userScope: "user:bob",
    });
    assert.equal(b1.cost.cached, false);
  });

  it("does not treat private memory-cited replies as cache-safe", () => {
    const d = selectCostRoute({
      intent: "greeting",
      userText: "hey",
      conversationDepth: 1,
      mayCiteMemory: true,
    });
    assert.equal(d.cacheSafe, false);
  });
});

describe("abuse protection", () => {
  beforeEach(() => {
    resetAbuseState();
    resetIntelligenceMetrics();
  });

  it("enforces request size and conversation length", () => {
    const big = checkIntelligenceAbuse({ text: "x".repeat(ABUSE_LIMITS.MAX_TEXT + 1) });
    assert.equal(big.ok, false);
    if (!big.ok) assert.equal(big.code, "request_size");

    const long = checkIntelligenceAbuse({
      text: "hi",
      conversationDepth: ABUSE_LIMITS.MAX_DEPTH + 1,
    });
    assert.equal(long.ok, false);
    if (!long.ok) assert.equal(long.code, "conversation_length");
  });

  it("rate-limits per user without exposing infrastructure", () => {
    for (let i = 0; i < ABUSE_LIMITS.USER_LIMIT; i += 1) {
      const ok = checkIntelligenceAbuse({ userId: "u1", text: `hi ${i}` });
      assert.equal(ok.ok, true);
    }
    const blocked = checkIntelligenceAbuse({ userId: "u1", text: "hi again" });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.code, "rate_user");
      assert.doesNotMatch(blocked.softMessage, /provider|openai|api key|circuit|rate limit/i);
    }
  });

  it("opens circuit after repeated provider failures", () => {
    recordProviderFailure();
    recordProviderFailure();
    recordProviderFailure();
    assert.equal(isProviderCircuitOpen(), true);
  });
});

describe("observability snapshot", () => {
  beforeEach(() => {
    resetAbuseState();
    resetIntelligenceMetrics();
    clearDeterministicCache();
  });

  it("tracks local vs external rates without user-facing leakage", () => {
    for (let i = 0; i < 5; i += 1) {
      buddyReplyFull({
        text: i % 2 === 0 ? "hey" : "I feel lonely",
        seed: `obs-${i}`,
        userScope: "user:obs",
        persistMemories: false,
      });
    }
    const snap = getIntelligenceCostSnapshot();
    assert.ok(snap.sample_count >= 5);
    assert.ok(snap.local_resolution_rate >= 0.99);
    assert.equal(snap.external_resolution_rate, 0);
    assert.equal(snap.estimated_cost_per_active_user, 0);
    assert.ok(snap.average_latency >= 0);
  });
});

describe("authorized provider gate", () => {
  beforeEach(() => {
    resetAbuseState();
    resetIntelligenceMetrics();
    clearDeterministicCache();
    setAuthorizedIntelligenceProvider(null);
  });

  it("never calls authorized provider for greetings even if registered", async () => {
    let called = 0;
    setAuthorizedIntelligenceProvider({
      complete: async () => {
        called += 1;
        return { text: "REMOTE SHOULD NOT APPEAR" };
      },
    });
    const out = resolveIntelligence({
      ...baseInput({ userText: "hey there", seed: "auth-gate" }),
      userScope: "user:auth",
    });
    assert.doesNotMatch(out.text, /REMOTE SHOULD NOT APPEAR/);
    assert.equal(called, 0);
    assert.equal(out.cost.estimatedCostUsd, 0);
  });
});
