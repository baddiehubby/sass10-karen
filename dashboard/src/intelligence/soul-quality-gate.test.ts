/**
 * Soul Engine quality gate — continuity cases + measured 1000-interaction simulation.
 * Metrics are printed from the actual run; do not invent resolution rates.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runSoulEngine } from "@/src/intelligence/soul-engine/run";
import { RESPONSE_DEDUP_WINDOW } from "@/src/intelligence/soul-engine/primitives";
import { wordingSimilarity, isTooSimilar } from "@/src/intelligence/variation";
import type { ConversationMachineState, ConversationTurn, IntelligenceResult } from "@/src/intelligence/types";

const PROMPTS = [
  "hey",
  "how are you",
  "I'm exhausted but I'm not tired.",
  "My sister is having trouble with her husband...",
  "My boss is being a real piece of work.",
  "I don't know what's wrong.",
  "...",
  "nothing",
  "remember when I told you...",
  "I changed my mind.",
  "that's not what I meant.",
  "work was rough today",
  "I finally got the job!",
  "I feel lonely tonight",
  "cheer me up",
  "goodbye",
  "I'm back",
  "just a small win — finished the form",
  "I failed the interview",
  "I feel calm",
] as const;

describe("soul quality gate — continuity cases", () => {
  it("sister + husband → support + high-confidence relationship memory", () => {
    const out = runSoulEngine({
      userText: "My sister is having trouble with her husband...",
      characterVoice: "warm",
      seed: "qg:sister",
      conversationDepth: 2,
    });
    assert.equal(out.intent, "support_other");
    assert.ok(out.response.length > 8);
    assert.equal(out.response, out.text);
    assert.equal(out.emotionalTone, out.emotion);
    assert.ok(typeof out.confidence === "number");
    assert.ok(Array.isArray(out.memoryCandidates));
    const persist = out.memoryToPersist;
    assert.ok(persist.some((m) => m.subject === "sister" && m.confidence >= 0.82));
    assert.ok(persist.every((m) => m.confidence >= 0.82));
  });

  it("exhausted but not tired → emotional exhaustion, not body-tired only", () => {
    const out = runSoulEngine({
      userText: "I'm exhausted but I'm not tired.",
      seed: "qg:exhaust",
      conversationDepth: 2,
    });
    assert.ok(
      out.intent === "emotional_exhaustion" || out.emotion === "exhausted",
      `got intent=${out.intent} emotion=${out.emotion}`,
    );
    assert.doesNotMatch(out.response, /sleep debt|yawns are data|body-tired/i);
  });

  it("boss piece of work → frustration / work continuity", () => {
    const out = runSoulEngine({
      userText: "My boss is being a real piece of work.",
      seed: "qg:boss",
      conversationDepth: 2,
    });
    assert.ok(
      out.intent === "frustration" || out.intent === "work" || out.topic === "work",
      `intent=${out.intent} topic=${out.topic}`,
    );
    assert.ok(out.response.length > 5);
  });

  it("I don't know what's wrong → uncertainty-friendly", () => {
    const out = runSoulEngine({
      userText: "I don't know what's wrong.",
      seed: "qg:idk",
      conversationDepth: 2,
    });
    assert.ok(
      out.intent === "uncertainty" || out.confidence < 0.75 || /not knowing|fog|allowed/i.test(out.response),
    );
  });

  it("silence / nothing stay coherent without inventing memory", () => {
    for (const text of ["...", "nothing"]) {
      const out = runSoulEngine({ userText: text, seed: `qg:sil:${text}`, conversationDepth: 1 });
      assert.ok(out.response.length > 0);
      assert.equal(out.memoryToPersist.length, 0);
      assert.ok(out.intent === "silence" || out.intent === "short_answer" || out.intent === "im_fine");
    }
  });

  it("remember when… does not invent a high-confidence fact", () => {
    const out = runSoulEngine({
      userText: "remember when I told you...",
      seed: "qg:remember",
      conversationDepth: 3,
    });
    assert.ok(out.intent === "memory_reference" || /remember|moment|thread|map/i.test(out.response));
    assert.equal(out.memoryToPersist.length, 0);
  });

  it("changed my mind / not what I meant → repair path, no new permanent memory", () => {
    for (const text of ["I changed my mind.", "that's not what I meant."]) {
      const out = runSoulEngine({
        userText: text,
        seed: `qg:corr:${text}`,
        conversationDepth: 3,
        recentTurns: [
          { role: "user", text: "I want to quit my job", at: new Date().toISOString() },
          { role: "buddy", text: "That sounds heavy.", at: new Date().toISOString() },
        ],
      });
      assert.ok(
        out.intent === "correction" || out.intent === "repair" || out.routed.isCorrection,
        `intent=${out.intent}`,
      );
      assert.equal(out.memoryToPersist.length, 0);
      assert.ok(out.response.length > 3);
    }
  });

  it("public contract fields are always present", () => {
    const out = runSoulEngine({ userText: "hey", seed: "qg:contract", conversationDepth: 1 });
    assert.equal(typeof out.response, "string");
    assert.equal(typeof out.confidence, "number");
    assert.equal(typeof out.intent, "string");
    assert.equal(typeof out.emotionalTone, "string");
    assert.equal(typeof out.topic, "string");
    assert.equal(typeof out.requiresAdvancedIntelligence, "boolean");
    assert.ok(Array.isArray(out.memoryCandidates));
    assert.equal(out.inference, "none");
    assert.equal(out.source, "local-intelligence");
  });
});

describe("soul quality gate — 1000-interaction simulation (measured)", () => {
  it("runs 1000 interactions and reports measured metrics", () => {
    const N = 1000;
    const responses: string[] = [];
    const families: string[] = [];
    const confidences: number[] = [];
    let fallbackish = 0;
    let invalid = 0;
    let memoryErrors = 0;
    let requiresAdvanced = 0;
    let exactDupInWindow = 0;
    let machine: ConversationMachineState | undefined;
    const turns: ConversationTurn[] = [];

    for (let i = 0; i < N; i++) {
      const userText = PROMPTS[i % PROMPTS.length]!;
      let out: IntelligenceResult;
      try {
        out = runSoulEngine({
          userText,
          characterVoice: i % 5 === 0 ? "playful" : "warm",
          conversationDepth: Math.min(12, 1 + (i % 8)),
          recentTurns: turns.slice(-8),
          responseHistory: responses.slice(-RESPONSE_DEDUP_WINDOW),
          recentFamilies: families.slice(-RESPONSE_DEDUP_WINDOW),
          previousMachine: machine,
          seed: `sim1000:${i}:${userText.slice(0, 24)}`,
        });
      } catch {
        invalid += 1;
        continue;
      }

      if (!out.response || typeof out.response !== "string" || out.response.length < 1) invalid += 1;
      if (out.inference !== "none") invalid += 1;
      if (out.response !== out.text) invalid += 1;
      if (out.emotionalTone !== out.emotion) invalid += 1;
      if (!Array.isArray(out.memoryCandidates)) memoryErrors += 1;
      if (out.memoryToPersist.some((m) => m.confidence < 0.82)) memoryErrors += 1;
      if (out.memoryToPersist.some((m) => /race|religion|sexual|disability|diagnosis/i.test(m.fact))) {
        memoryErrors += 1;
      }

      confidences.push(out.confidence);
      if (out.requiresAdvancedIntelligence) requiresAdvanced += 1;
      if (/i'?m right here with you\.?$/i.test(out.response.trim())) fallbackish += 1;

      const window = responses.slice(-RESPONSE_DEDUP_WINDOW);
      if (window.includes(out.response)) exactDupInWindow += 1;
      if (isTooSimilar(out.response, window)) {
        // counted separately via similarity below
      }

      responses.push(out.response);
      families.push(out.familyId);
      machine = out.conversation;
      turns.push(
        { role: "user", text: userText, intent: out.intent, at: new Date().toISOString() },
        { role: "buddy", text: out.response, intent: out.intent, at: new Date().toISOString() },
      );
      if (turns.length > 24) turns.splice(0, turns.length - 24);
    }

    // Pairwise similarity on a sample of consecutive pairs
    let simSum = 0;
    let simPairs = 0;
    for (let i = 1; i < responses.length; i++) {
      simSum += wordingSimilarity(responses[i - 1]!, responses[i]!);
      simPairs += 1;
    }
    const avgAdjacentSimilarity = simPairs ? simSum / simPairs : 0;
    const uniqueResponses = new Set(responses).size;
    const uniqueRatio = responses.length ? uniqueResponses / responses.length : 0;
    const avgConfidence = confidences.length
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;
    const confBuckets = { low: 0, mid: 0, high: 0 };
    for (const c of confidences) {
      if (c < 0.45) confBuckets.low += 1;
      else if (c < 0.75) confBuckets.mid += 1;
      else confBuckets.high += 1;
    }

    const metrics = {
      interactions: N,
      completed: responses.length,
      uniqueResponses,
      uniqueRatio: Number(uniqueRatio.toFixed(4)),
      exactDupInWindow,
      avgAdjacentSimilarity: Number(avgAdjacentSimilarity.toFixed(4)),
      fallbackish,
      fallbackRate: Number((fallbackish / Math.max(1, responses.length)).toFixed(4)),
      invalidOutputs: invalid,
      memoryExtractionErrors: memoryErrors,
      avgConfidence: Number(avgConfidence.toFixed(4)),
      confidenceDistribution: confBuckets,
      requiresAdvancedIntelligenceCount: requiresAdvanced,
      requiresAdvancedRate: Number((requiresAdvanced / Math.max(1, responses.length)).toFixed(4)),
      // Local resolution: Soul Engine always runs; advanced flag is observability only.
      localResolutionRate: Number((1 - requiresAdvanced / Math.max(1, responses.length)).toFixed(4)),
    };

    // eslint-disable-next-line no-console
    console.log("[soul-quality-sim] measured metrics:", JSON.stringify(metrics, null, 2));

    assert.equal(responses.length, N, "all interactions should complete");
    assert.equal(invalid, 0, "no invalid outputs");
    assert.equal(memoryErrors, 0, "no memory extraction contract errors");
    assert.ok(uniqueRatio >= 0.35, `uniqueRatio too low: ${uniqueRatio}`);
    assert.ok(avgAdjacentSimilarity < 0.85, `adjacent similarity too high: ${avgAdjacentSimilarity}`);
    assert.ok(exactDupInWindow < N * 0.15, `too many exact dups in window: ${exactDupInWindow}`);
    // Do NOT assert an 80% local resolution marketing claim — report measured rate only.
    assert.ok(metrics.localResolutionRate >= 0, "local resolution rate measured");
  });
});
