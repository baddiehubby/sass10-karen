import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertVerdictPreserved,
  deescalateToSweet,
  isSafeDelivery,
  KAREN_INTENSITY_LIMITS,
  recordedRefsFromContext,
  resolveConfig,
  scrubUnsafe,
  styleLine,
  styleVerdictResult,
  switchMood,
} from "@/lib/karen/interview/personality-controller";
import { ingestLifeContext } from "@/lib/karen/interview/context-engine";
import { evaluateAnswer } from "@/lib/karen/interview/response-engine";
import { recordLifeFact } from "@/lib/karen/interview/session-memory";
import {
  createEmptyInterviewState,
  type KarenIntensity,
  type KarenMood,
  type KarenProbeQuestion,
} from "@/lib/karen/interview/types";

const MOODS: KarenMood[] = ["sweet", "sarcastic", "annoyed", "furious"];
const INTENSITIES: KarenIntensity[] = [1, 2, 3, 4, 5];

const NEUTRAL_Q = "Did you keep your gym promise?";
const NEUTRAL_FOLLOW = "Busy doing what, exactly?";

function sampleQuestion(): KarenProbeQuestion {
  return {
    id: "q-gym",
    category: "commitment",
    entry: "gym",
    question: NEUTRAL_Q,
    anchor: "promise:gym",
    evidence: "confirmed promise",
    push: NEUTRAL_FOLLOW,
    floor: "Name one concrete action.",
    rankScore: 12,
    status: "queued",
    timesAsked: 0,
    bestScore: null,
  };
}

describe("Karen personality-controller — Stage 4", () => {
  it("styles every mood at every intensity without dropping the core meaning", () => {
    for (const mood of MOODS) {
      for (const intensity of INTENSITIES) {
        const out = styleLine({
          kind: "question",
          text: NEUTRAL_Q,
          config: resolveConfig({ mood, intensity }),
          recorded: {
            promises: ["go to the gym every weekday"],
            excuses: ["I was busy"],
            completions: [],
          },
        });
        assert.ok(out.text.includes("gym") || out.text.includes(NEUTRAL_Q), `${mood}@${intensity}`);
        assert.match(out.text, /gym promise|gym every weekday|Did you keep/i);
        assert.equal(out.preservedVerdict, null);
        assert.equal(isSafeDelivery(out.text), true);
        assert.equal(out.intensity, intensity);
        // Crisis not present → mood preserved (sweet stays sweet; others stay).
        if (!out.safetyTriggered) {
          assert.equal(out.mood, mood);
        }
        assert.ok(KAREN_INTENSITY_LIMITS[intensity].maxRoast >= 1);
      }
    }
  });

  it("preserves verdict enum across all moods and intensities", () => {
    let state = createEmptyInterviewState("p4");
    state = recordLifeFact(state, {
      kind: "completion",
      text: "went to the gym for 45 minutes",
      key: "gym 45 minutes",
    });
    state = recordLifeFact(state, {
      kind: "promise",
      text: "go to the gym every weekday",
      key: "gym weekday",
    });
    const evaluated = evaluateAnswer({
      question: sampleQuestion(),
      answer: "I went to the gym for 45 minutes",
      rung: "surface",
      state,
    });
    assert.equal(evaluated.kind, "verdict");
    if (evaluated.kind !== "verdict") return;
    const before = evaluated.result.verdict;

    for (const mood of MOODS) {
      for (const intensity of INTENSITIES) {
        const styled = styleVerdictResult(evaluated.result, {
          config: resolveConfig({ mood, intensity, allowTheatricalRoast: true }),
          recorded: recordedRefsFromContext(ingestLifeContext(state)),
        });
        assertVerdictPreserved(before, styled.verdict);
        assert.equal(styled.verdict, "solid");
        assert.equal(styled.label, "Solid");
        assert.ok(styled.coaching.say.length > 5);
        assert.equal(isSafeDelivery(styled.line.text), true);
      }
    }
  });

  it("uses contextual sarcasm tied to recorded excuses, not random canned insults", () => {
    const withExcuse = styleLine({
      kind: "followup",
      text: NEUTRAL_FOLLOW,
      config: resolveConfig({ mood: "sarcastic", intensity: 3 }),
      recorded: { promises: [], excuses: ["I was busy"], completions: [] },
    });
    assert.match(withExcuse.text, /I was busy/i);
    assert.equal(/idiot|stupid|loser|pathetic|worthless/i.test(withExcuse.text), false);

    const noRecord = styleLine({
      kind: "followup",
      text: NEUTRAL_FOLLOW,
      config: resolveConfig({ mood: "sarcastic", intensity: 3 }),
      recorded: { promises: [], excuses: [], completions: [] },
    });
    // Still includes the neutral follow-up meaning.
    assert.match(noRecord.text, /Busy doing what/i);
  });

  it("distinguishes recorded facts from user claims in delivery", () => {
    const claim = styleLine({
      kind: "verdict",
      text: "Shaky. Answer was vague.",
      config: resolveConfig({ mood: "sarcastic", intensity: 3 }),
      verdict: "shaky",
      verdictLabel: "Shaky",
      isUserClaim: true,
      recorded: { promises: ["write daily"], excuses: [], completions: [] },
    });
    assert.match(claim.text, /your claim, not a recorded fact/i);

    const fact = styleLine({
      kind: "verdict",
      text: "Solid. Matched a recorded completion.",
      config: resolveConfig({ mood: "annoyed", intensity: 3 }),
      verdict: "solid",
      verdictLabel: "Solid",
      isUserClaim: false,
      recorded: {
        promises: [],
        excuses: [],
        completions: ["wrote for one hour"],
      },
    });
    assert.equal(/your claim, not a recorded fact/i.test(fact.text), false);
  });

  it("never invents memories when no recorded refs exist", () => {
    const out = styleLine({
      kind: "question",
      text: NEUTRAL_Q,
      config: resolveConfig({ mood: "furious", intensity: 5, allowTheatricalRoast: true }),
      recorded: { promises: [], excuses: [], completions: [] },
    });
    assert.equal(/you promised me|i saw you|i watched you|i observed/i.test(out.text), false);
    assert.match(out.text, /gym promise/i);
  });

  it("blocks discriminatory slurs, threats, and unsafe phrasing via scrub", () => {
    assert.equal(isSafeDelivery("kill yourself"), false);
    assert.match(scrubUnsafe("you retard"), /\[removed\]/i);
    for (const mood of MOODS) {
      const out = styleLine({
        kind: "followup",
        text: NEUTRAL_FOLLOW,
        config: resolveConfig({ mood, intensity: 5, allowTheatricalRoast: true }),
        recorded: { promises: ["gym"], excuses: ["busy"], completions: [] },
      });
      assert.equal(isSafeDelivery(out.text), true);
      assert.equal(BANNED_SMOKE(out.text), false);
    }
  });

  it("de-escalates to Sweet immediately", () => {
    const hot = resolveConfig({ mood: "furious", intensity: 5, allowTheatricalRoast: true });
    const calm = deescalateToSweet(hot);
    assert.equal(calm.mood, "sweet");
    assert.ok(calm.intensity <= 2);
    assert.equal(calm.allowTheatricalRoast, false);

    const styled = styleLine({
      kind: "verdict",
      text: "Couldn't defend. Admission of skip.",
      config: calm,
      verdict: "failed",
      verdictLabel: "Couldn't defend",
    });
    assert.equal(styled.mood, "sweet");
    assert.equal(styled.faceCue, "smile");
    assert.match(styled.text, /Couldn't defend|honest read|Admission/i);
  });

  it("supports explicit mode switching without changing evaluation", () => {
    const base = resolveConfig({ mood: "sweet", intensity: 3 });
    const furious = switchMood(base, "furious");
    assert.equal(furious.mood, "furious");
    const back = switchMood(furious, "sarcastic");
    assert.equal(back.mood, "sarcastic");

    const a = styleLine({
      kind: "question",
      text: NEUTRAL_Q,
      config: furious,
      verdict: "shaky",
    });
    const b = styleLine({
      kind: "question",
      text: NEUTRAL_Q,
      config: back,
      verdict: "shaky",
    });
    assert.equal(a.preservedVerdict, "shaky");
    assert.equal(b.preservedVerdict, "shaky");
    assert.notEqual(a.text, b.text);
  });

  it("bypasses roast on crisis/distress language and softens delivery", () => {
    const out = styleLine({
      kind: "followup",
      text: NEUTRAL_FOLLOW,
      config: resolveConfig({ mood: "furious", intensity: 5, allowTheatricalRoast: true }),
      userText: "I want to kill myself",
      recorded: { promises: ["gym"], excuses: ["busy"], completions: [] },
    });
    assert.equal(out.safetyTriggered, true);
    assert.equal(out.roastBypassed, true);
    assert.equal(out.mood, "sweet");
    assert.equal(out.faceCue, "softened");
    assert.match(out.text, /pausing the roast/i);
    assert.match(out.text, /iasp\.info|emergency/i);
    assert.equal(/OH COME ON|full-time job/i.test(out.text), false);
  });

  it("keeps Buddy personality concepts out of Karen defaults", () => {
    const cfg = resolveConfig();
    assert.notEqual(cfg.mood, "warm" as string);
    assert.ok(["sweet", "sarcastic", "annoyed", "furious"].includes(cfg.mood));
  });

  it("caps shouting and exaggerated insults by intensity limits", () => {
    const low = styleLine({
      kind: "followup",
      text: NEUTRAL_FOLLOW,
      config: resolveConfig({ mood: "furious", intensity: 2, allowTheatricalRoast: true }),
      recorded: { promises: [], excuses: ["I was busy"], completions: [] },
    });
    assert.equal(/OH COME ON/i.test(low.text), false);

    const high = styleLine({
      kind: "followup",
      text: NEUTRAL_FOLLOW,
      config: resolveConfig({ mood: "furious", intensity: 5, allowTheatricalRoast: true }),
      recorded: { promises: [], excuses: ["I was busy"], completions: [] },
    });
    assert.match(high.text, /OH COME ON|full-time job|I was busy/i);
    assert.equal(high.faceCue, "shouting");
  });
});

function BANNED_SMOKE(text: string): boolean {
  return /\b(slut|whore|retard|nigger|faggot|kys|kill yourself)\b/i.test(text);
}
