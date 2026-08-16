import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { baseInput } from "@/src/intelligence/__fixtures__/intents";
import {
  ABUSE_LIMITS,
  CONTEXT_LIMITS,
  NEVER_EXPENSIVE_INTENTS,
  assessGenuineExternalNeed,
  buildInternalCostTelemetry,
  checkIntelligenceAbuse,
  clearDeterministicCache,
  evaluateUserProviderCredential,
  getIntelligenceCostSnapshot,
  isArbitraryProviderProxyAllowed,
  isNeverExpensiveIntent,
  looksLikeStaticProductRequest,
  minimizeIntelligenceContext,
  resetAbuseState,
  resetCoalesceState,
  resetIntelligenceMetrics,
  resolveIntelligence,
  selectCostRoute,
  setAuthorizedIntelligenceProvider,
  recordProviderFailure,
  isProviderCircuitOpen,
} from "@/src/intelligence/cost";
import { createAuthorizedIntelligenceProvider } from "@/src/intelligence/cost/providers/authorized";
import { summarizeMemoriesLocally } from "@/src/intelligence/memory/summarize-local";
import { buddyReplyFull } from "@/lib/buddy-intelligence";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

describe("cost routing priority", () => {
  beforeEach(() => {
    resetAbuseState();
    resetIntelligenceMetrics();
    clearDeterministicCache();
    resetCoalesceState();
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
    resetCoalesceState();
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
    resetCoalesceState();
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
    assert.ok(snap.local_responses >= 5);
    assert.ok(snap.local_confidence > 0);
    assert.equal(snap.estimated_external_cost, 0);
    assert.ok(typeof snap.advanced_route_count === "number");
    assert.ok(typeof snap.fallback_count === "number");
  });

  it("builds internal telemetry structure without proxy allowance", () => {
    buddyReplyFull({
      text: "hey",
      seed: "tel-1",
      userScope: "user:tel",
      persistMemories: false,
    });
    const tel = buildInternalCostTelemetry();
    assert.equal(tel.claimScope, "zero_marginal_ai_inference_cost_core_experience");
    assert.match(tel.disclaimer, /Does not include database/i);
    assert.equal(tel.gates.arbitraryProviderProxyAllowed, false);
    assert.ok(tel.snapshot.local_responses >= 1);
  });
});

describe("context minimize + coalesce + credentials", () => {
  beforeEach(() => {
    resetAbuseState();
    resetIntelligenceMetrics();
    clearDeterministicCache();
    resetCoalesceState();
  });

  it("minimizes long turn history", () => {
    const turns = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "buddy") as "user" | "buddy",
      text: `turn ${i} ${"word ".repeat(40)}`,
      at: new Date().toISOString(),
    }));
    const m = minimizeIntelligenceContext({
      userText: "hello",
      recentTurns: turns,
      responseHistory: turns.filter((t) => t.role === "buddy").map((t) => t.text),
    });
    assert.ok(m.recentTurns.length <= CONTEXT_LIMITS.MAX_RECENT_TURNS);
    assert.ok(m.droppedTurns >= 20);
    assert.ok(m.keptChars < turns.reduce((n, t) => n + t.text.length, 0));
  });

  it("coalesces identical same-tick resolutions", () => {
    const text = "help me plan my ambitious year goals carefully";
    const a = resolveIntelligence({
      ...baseInput({ userText: text, seed: "coa-a", conversationDepth: 4 }),
      userScope: "user:coa",
    });
    const b = resolveIntelligence({
      ...baseInput({ userText: text, seed: "coa-b", conversationDepth: 4 }),
      userScope: "user:coa",
    });
    assert.equal(a.cost.coalesced, false);
    assert.equal(b.cost.coalesced, true);
    assert.equal(a.text, b.text);
    assert.equal(a.cost.cached, false);
    assert.equal(b.cost.cached, false);
  });

  it("rejects BYOK credentials and forbids arbitrary proxy", () => {
    const d = evaluateUserProviderCredential({
      provider: "openai",
      apiKey: "sk-test",
      storeOnServer: true,
    });
    assert.equal(d.accepted, false);
    assert.equal(isArbitraryProviderProxyAllowed(), false);
    assert.equal(createAuthorizedIntelligenceProvider({ userPostedApiKey: "sk-test" }), null);
  });

  it("does not escalate from requiresAdvancedIntelligence alone", () => {
    assert.equal(
      assessGenuineExternalNeed({
        requiresAdvancedIntelligence: true,
        confidence: 0.1,
        explicitApprovedGap: false,
      }),
      false,
    );
    const d = selectCostRoute({
      intent: "goals",
      userText: "help me plan my year with nuance",
      conversationDepth: 6,
      genuineExternalNeed: assessGenuineExternalNeed({
        requiresAdvancedIntelligence: true,
        explicitApprovedGap: false,
      }),
      userAuthorizedEnabled: true,
    });
    assert.equal(d.mayEscalate, false);
    assert.equal(d.neverExpensive, true);
  });

  it("summarizes memories locally without inference", () => {
    const summary = summarizeMemoriesLocally([
      {
        category: "relationship",
        subject: "sister",
        relationship: "family",
        topic: "family",
        fact: "sister may be going through difficulties; user is concerned",
        confidence: 0.9,
        relevance: 0.86,
        source: "user_statement",
        createdAt: new Date().toISOString(),
      },
      {
        category: "other",
        subject: "user",
        relationship: null,
        topic: "noise",
        fact: "low confidence noise",
        confidence: 0.3,
        relevance: 0.2,
        source: "user_statement",
        createdAt: new Date().toISOString(),
      },
    ]);
    assert.equal(summary.usedExternalInference, false);
    assert.equal(summary.retained.length, 1);
    assert.match(summary.rollup, /sister/i);
  });
});

describe("authorized provider gate", () => {
  beforeEach(() => {
    resetAbuseState();
    resetIntelligenceMetrics();
    clearDeterministicCache();
    resetCoalesceState();
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

describe("no hidden AI provider proxy in API routes", () => {
  it("scans app/api for openai/anthropic completion proxies", () => {
    const apiRoot = join(process.cwd(), "app", "api");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (name.endsWith(".ts") || name.endsWith(".js")) files.push(p);
      }
    };
    walk(apiRoot);
    const forbidden =
      /api\.openai\.com|api\.anthropic\.com|openai\.chat|anthropic\.messages|ChatCompletion|createCompletion\s*\(/i;
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (forbidden.test(src)) offenders.push(f);
    }
    assert.deepEqual(offenders, []);
    assert.ok(files.some((f) => f.replace(/\\/g, "/").includes("internal/intelligence-cost")));
  });
});
