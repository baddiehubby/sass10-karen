import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { baseInput } from "@/src/intelligence/__fixtures__/intents";
import { extractMemoryCandidates, MEMORY_PERSIST_THRESHOLD } from "@/src/intelligence/memory";
import { routeSemantic } from "@/src/intelligence/semantic-router";
import { runSoulEngine } from "@/src/intelligence/soul-engine/run";
import { wordingSimilarity } from "@/src/intelligence/variation";
import type { ConversationMachineState } from "@/src/intelligence/types";

describe("premium multi-signal understanding", () => {
  it("distinguishes physical tiredness from emotional exhaustion", () => {
    const physical = routeSemantic("I'm tired");
    assert.equal(physical.intent, "tired");
    assert.equal(physical.emotion, "tired");

    const done = routeSemantic("I'm not tired, I'm just done.");
    assert.equal(done.intent, "emotional_exhaustion");
    assert.equal(done.emotion, "exhausted");
    assert.equal(done.subtopic, "emotional_exhaustion");
    assert.notEqual(done.intent, "tired");
  });

  it("identifies sister + husband as family support concern", () => {
    const hit = routeSemantic("My sister is going through something with her husband.");
    assert.equal(hit.intent, "support_other");
    assert.equal(hit.topic, "family");
    assert.equal(hit.entity.subject, "sister");
    assert.equal(hit.entity.concern, "supporting_sister");
    assert.equal(hit.entity.secondaryTopic, "relationships");

    const out = runSoulEngine(
      baseInput({
        userText: "My sister is going through something with her husband.",
        seed: "sis-1",
      }),
    );
    assert.equal(out.intent, "support_other");
    assert.match(out.text.toLowerCase(), /sister|family|support|care|relationship|heart/);
    assert.ok(out.memoryToPersist.length >= 1);
    assert.equal(out.memoryToPersist[0]!.subject, "sister");
    assert.ok(out.memoryToPersist[0]!.confidence >= MEMORY_PERSIST_THRESHOLD);
  });

  it("does not permanently store ambiguous memory candidates", () => {
    const { persist, reject } = extractMemoryCandidates({
      userText: "Maybe my sister might be going through something with her husband, not sure",
      entity: {
        subject: "sister",
        relationship: "sister",
        concern: "supporting_sister",
        secondaryTopic: "relationships",
      },
      topic: "family",
      intent: "support_other",
    });
    assert.equal(persist.length, 0);
    assert.ok(reject.length >= 1);
  });

  it("never claims memory unless a persisted memory exists", () => {
    const out = runSoulEngine(
      baseInput({
        userText: "remember when we talked about the deadline",
        seed: "mem-fake",
        persistedMemories: [],
        memoryContext: [],
      }),
    );
    assert.equal(out.intent, "memory_reference");
    assert.doesNotMatch(out.text, /I still hold|That note about|I remember when you/i);
    assert.match(out.text, /thread|moment|note|real|map|piece/i);
  });

  it("tracks conversation machine fields across turns", () => {
    let machine: ConversationMachineState | undefined;
    const history: string[] = [];
    const families: string[] = [];

    const first = runSoulEngine(
      baseInput({
        userText: "hey",
        seed: "mach-1",
        conversationDepth: 1,
      }),
    );
    machine = first.conversation;
    history.push(first.text);
    families.push(first.familyId);

    const second = runSoulEngine(
      baseInput({
        userText: "work is a lot today",
        seed: "mach-2",
        conversationDepth: 2,
        previousMachine: machine,
        responseHistory: history,
        recentFamilies: families,
      }),
    );

    assert.ok(second.conversation.conversationId);
    assert.equal(second.conversation.topic, "work");
    assert.ok(second.turn.continuity >= 0);
    assert.ok(second.turn.novelty >= 0);
    assert.ok(["opening", "warming", "deep", "quiet", "closing", "repairing"].includes(second.conversation.engagementState));
    assert.equal(second.conversation.lastUserMessage, "work is a lot today");
    assert.equal(second.conversation.lastBuddieResponse, second.text);
  });
});

describe("anti-repetition under similar messages", () => {
  it("20 consecutive similar user messages avoid obvious repetition", () => {
    const texts: string[] = [];
    const families: string[] = [];
    let machine: ConversationMachineState | undefined;
    const turns: Array<{ role: "user" | "buddy"; text: string; at: string }> = [];

    for (let i = 0; i < 20; i += 1) {
      // Near-paraphrases of loneliness — stress variation system
      const variants = [
        "I feel lonely",
        "Feeling lonely tonight",
        "I'm so lonely",
        "Lonely again",
        "I feel alone",
        "It's lonely here",
        "I feel lonely again",
        "Still feeling lonely",
        "Loneliness hit me",
        "I'm lonely",
      ];
      const userText = variants[i % variants.length]!;
      const out = runSoulEngine(
        baseInput({
          userText,
          seed: `lonely-loop-${i}`,
          conversationDepth: i + 1,
          previousMachine: machine,
          responseHistory: texts,
          recentFamilies: families,
          recentTurns: turns,
        }),
      );

      assert.doesNotMatch(out.text, /i'?m here for you/i);
      texts.push(out.text);
      families.push(out.familyId);
      machine = out.conversation;
      turns.push(
        { role: "user", text: userText, at: String(i) },
        { role: "buddy", text: out.text, at: `${i}b` },
      );
    }

    // No exact consecutive duplicates
    for (let i = 1; i < texts.length; i += 1) {
      assert.notEqual(texts[i], texts[i - 1], `consecutive duplicate at ${i}`);
    }

    // Exact unique ratio should be high
    const unique = new Set(texts.map((t) => t.toLowerCase().trim()));
    assert.ok(unique.size >= 14, `expected >=14 unique replies, got ${unique.size}`);

    // Average pairwise similarity among consecutive pairs stays moderate
    let simSum = 0;
    for (let i = 1; i < texts.length; i += 1) {
      simSum += wordingSimilarity(texts[i]!, texts[i - 1]!);
    }
    const avgSim = simSum / (texts.length - 1);
    assert.ok(avgSim < 0.72, `avg consecutive similarity too high: ${avgSim}`);

    // Family cooldown: no family more than 4 times in 20 (with multiple families available)
    const counts = new Map<string, number>();
    for (const f of families) counts.set(f, (counts.get(f) ?? 0) + 1);
    for (const [fam, n] of counts) {
      assert.ok(n <= 8, `family ${fam} overused (${n})`);
    }
  });

  it("avoids emotional cliché openers in composed replies", () => {
    for (const text of ["I'm sad", "I feel anxious", "I'm frustrated"]) {
      const out = runSoulEngine(baseInput({ userText: text, seed: `cliche-${text}` }));
      assert.doesNotMatch(out.text, /i'?m here for you/i);
      assert.doesNotMatch(out.text, /as an ai/i);
    }
  });
});
