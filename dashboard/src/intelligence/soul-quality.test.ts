import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { baseInput } from "@/src/intelligence/__fixtures__/intents";
import { contradictsPrevious, routeSemantic } from "@/src/intelligence/semantic-router";
import {
  extractMemoryCandidates,
  memoryHintLine,
  MEMORY_PERSIST_THRESHOLD,
} from "@/src/intelligence/memory";
import { runSoulEngine } from "@/src/intelligence/soul-engine/run";
import {
  fingerprintCollision,
  responseFingerprint,
} from "@/src/intelligence/variation";

describe("soul primitives routing", () => {
  const cases: Array<{ text: string; intent: string }> = [
    { text: "hey", intent: "greeting" },
    { text: "how are you", intent: "emotional_checkin" },
    { text: "...", intent: "silence" },
    { text: "cheer me up please", intent: "encouragement" },
    { text: "I finally got the job!", intent: "celebration" },
    { text: "I'm so frustrated with this", intent: "frustration" },
    { text: "I feel so lonely tonight", intent: "loneliness" },
    { text: "I don't know", intent: "uncertainty" },
    { text: "I've been reflecting on last year", intent: "reflection" },
    { text: "this morning I made coffee then left", intent: "daily_routine" },
    { text: "small win today — finished the form", intent: "small_win" },
    { text: "I failed the interview", intent: "setback" },
    { text: "I can't start, no motivation", intent: "motivation" },
    { text: "I feel calm", intent: "calm" },
    { text: "let's play", intent: "playfulness" },
    { text: "I'm curious about that", intent: "curiosity" },
    { text: "goodbye", intent: "farewell" },
    { text: "I'm back", intent: "returning" },
  ];

  for (const c of cases) {
    it(`routes “${c.text}” → ${c.intent}`, () => {
      const hit = routeSemantic(c.text);
      assert.equal(hit.intent, c.intent);
      const out = runSoulEngine(baseInput({ userText: c.text, seed: `prim-${c.intent}` }));
      assert.equal(out.intent, c.intent);
      assert.ok(out.text.length > 3);
      assert.doesNotMatch(out.text, /you definitely/i);
    });
  }
});

describe("edge-case quality", () => {
  it("handles contradictory mood flip without pretending sameness", () => {
    assert.equal(contradictsPrevious("I'm really sad now", ["I'm so happy today"]), true);
    const out = runSoulEngine(
      baseInput({
        userText: "I'm really sad now",
        seed: "contradict-1",
        recentTurns: [{ role: "user", text: "I'm so happy today", at: "1" }],
      }),
    );
    assert.ok(
      out.routed.signals.includes("contradiction") || out.routed.subtopic === "mood_shift",
    );
    assert.equal(out.intent, "sadness");
    assert.doesNotMatch(out.text, /you (are|were) definitely happy/i);
  });

  it("treats ambiguous hedges as low-confidence / uncertainty-friendly", () => {
    const hit = routeSemantic("Maybe I got a design job, not sure");
    assert.ok(hit.confidence <= 0.7 || hit.intent === "uncertainty" || hit.signals.includes("ambiguous"));
    const { persist } = extractMemoryCandidates({
      userText: "Maybe I got a design job, not sure",
      entity: { subject: null, relationship: null, concern: null, secondaryTopic: null },
      topic: "work",
      intent: "work",
    });
    assert.equal(persist.length, 0);
  });

  it("does not celebrate sarcasm as a win", () => {
    const hit = routeSemantic("Yeah right I got the job /s");
    assert.ok(hit.intent === "uncertainty" || hit.signals.includes("sarcasm"));
    assert.ok(hit.confidence < 0.6);
  });

  it("handles slang without crashing", () => {
    const mid = routeSemantic("feeling mid today");
    assert.ok(["emotional_checkin", "sadness", "smalltalk"].includes(mid.intent));
    const vibe = routeSemantic("good vibes fr fr");
    assert.ok(["playfulness", "excitement", "smalltalk"].includes(vibe.intent));
  });

  it("tolerates loneliness typo", () => {
    const hit = routeSemantic("im so lonley");
    assert.equal(hit.intent, "loneliness");
  });

  it("handles short replies", () => {
    const hit = routeSemantic("yep", { isShort: true });
    assert.equal(hit.intent, "short_answer");
    const out = runSoulEngine(baseInput({ userText: "yep", seed: "short-1" }));
    assert.ok(out.text.length >= 2);
  });

  it("treats ellipsis as silence", () => {
    assert.equal(routeSemantic("...").intent, "silence");
    const out = runSoulEngine(baseInput({ userText: "...", seed: "sil-1" }));
    assert.equal(out.intent, "silence");
  });

  it("handles emotional statements coherently", () => {
    for (const text of ["I'm really sad", "I feel anxious", "I feel lonely"]) {
      const out = runSoulEngine(baseInput({ userText: text, seed: `emo-${text}` }));
      assert.ok(out.text.length > 8);
      assert.doesNotMatch(out.text, /i'?m here for you/i);
      assert.doesNotMatch(out.text, /as an ai/i);
    }
  });

  it("tracks topic change across turns", () => {
    const first = runSoulEngine(baseInput({ userText: "work is a lot", seed: "tc-1", conversationDepth: 1 }));
    const second = runSoulEngine(
      baseInput({
        userText: "anyway my sister called",
        seed: "tc-2",
        conversationDepth: 2,
        previousMachine: first.conversation,
        recentTurns: [
          { role: "user", text: "work is a lot", at: "1" },
          { role: "buddy", text: first.text, at: "2" },
        ],
      }),
    );
    assert.notEqual(second.conversation.topic, "work");
    assert.ok(["family", "relationships"].includes(second.conversation.topic) || second.intent === "family" || second.intent === "support_other");
  });

  it("varies repeated messages via fingerprints", () => {
    const texts: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const out = runSoulEngine(
        baseInput({
          userText: "I feel lonely",
          seed: `rep-fp-${i}`,
          conversationDepth: i + 1,
          responseHistory: texts,
        }),
      );
      texts.push(out.text);
    }
    for (let i = 1; i < texts.length; i += 1) {
      assert.notEqual(texts[i], texts[i - 1]);
    }
    const fps = texts.map(responseFingerprint);
    const openings = new Set(fps.map((f) => f.opening));
    assert.ok(openings.size >= 2);
  });

  it("stays present on multilingual input without pretending comprehension", () => {
    const hit = routeSemantic("你好吗");
    assert.ok(hit.confidence <= 0.55);
    assert.ok(hit.signals.includes("multilingual") || hit.signals.includes("uncertain_comprehension"));
    const out = runSoulEngine(baseInput({ userText: "こんにちは", seed: "ml-1" }));
    assert.ok(out.text.length > 3);
    assert.doesNotMatch(out.text, /you (said|meant|definitely)/i);
  });
});

describe("structured memory quality", () => {
  it("persists only high-confidence structured candidates", () => {
    const out = runSoulEngine(
      baseInput({
        userText: "My sister is going through something with her husband.",
        seed: "mem-hi",
      }),
    );
    assert.ok(out.memoryToPersist.length >= 1);
    const m = out.memoryToPersist[0]!;
    assert.equal(m.category, "relationship");
    assert.equal(m.subject, "sister");
    assert.ok(m.confidence >= MEMORY_PERSIST_THRESHOLD);
    assert.ok(typeof m.relevance === "number");
  });

  it("soft-cites memory as fallible context", () => {
    const hint = memoryHintLine(
      [
        {
          category: "relationship",
          subject: "sister",
          relationship: "sister",
          topic: "family",
          fact: "having relationship difficulties",
          relevance: 0.86,
          confidence: 0.86,
          source: "user_statement",
          createdAt: new Date().toISOString(),
        },
      ],
      true,
    );
    assert.ok(hint);
    assert.match(hint!, /I remember you mentioned/i);
    assert.doesNotMatch(hint!, /you definitely/i);
  });

  it("never invents memory when none persisted", () => {
    const out = runSoulEngine(
      baseInput({
        userText: "remember when we talked about the deadline",
        seed: "mem-none",
        persistedMemories: [],
      }),
    );
    assert.doesNotMatch(out.text, /I remember you mentioned/i);
    assert.doesNotMatch(out.text, /you definitely/i);
  });

  it("rejects sensitive-attribute guesses", () => {
    const { persist, reject } = extractMemoryCandidates({
      userText: "my sister is going through something",
      entity: {
        subject: "sister",
        relationship: "sister",
        concern: "supporting_sister",
        secondaryTopic: "relationships",
      },
      topic: "family",
      intent: "support_other",
    });
    // Without husband marker confidence may be below threshold
    for (const c of [...persist, ...reject]) {
      assert.doesNotMatch(c.fact, /race|religion|sexual|disability|diagnosis/i);
    }
  });
});

describe("fingerprint helpers", () => {
  it("detects opening collisions", () => {
    const a = "Soft pulse from the quiet corner.";
    const b = "Soft pulse from the quiet night.";
    assert.equal(fingerprintCollision(b, [a]), true);
  });
});
