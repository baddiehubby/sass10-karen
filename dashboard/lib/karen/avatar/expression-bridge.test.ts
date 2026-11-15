import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blinkFromPhase,
  clamp01,
  clampBridgeIntensity,
  jawFromPhase,
  nonZeroBlendshapes,
  resolveKarenExpression,
  type KarenArkitBlendshapes,
} from "@/lib/karen/avatar/expression-bridge";

function assertAllInRange(shapes: KarenArkitBlendshapes) {
  for (const [k, v] of Object.entries(shapes)) {
    assert.ok(v >= 0 && v <= 1, `${k}=${v} out of 0–1`);
  }
}

describe("Karen expression bridge — Stage 6C-A", () => {
  it("clamps intensity to 1–5 and blendshapes to 0–1", () => {
    assert.equal(clampBridgeIntensity(0), 1);
    assert.equal(clampBridgeIntensity(99), 5);
    assert.equal(clampBridgeIntensity(NaN), 3);
    assert.equal(clampBridgeIntensity(undefined), 3);
    assert.equal(clamp01(-1), 0);
    assert.equal(clamp01(2), 1);
    assert.equal(clamp01(Number.NaN), 0);

    const hot = resolveKarenExpression({
      mood: "furious",
      intensity: 99,
      faceCue: "shouting",
      animationPhase: 0.25,
      presence: "speaking",
    });
    assertAllInRange(hot);
  });

  it("Sweet produces soft smile with relaxed brows and blinking", () => {
    const atBlink = resolveKarenExpression({
      mood: "sweet",
      intensity: 3,
      faceCue: "smile",
      presence: "listening",
      animationPhase: 0.015,
    });
    assertAllInRange(atBlink);
    assert.ok(atBlink.mouthSmileLeft > 0.3);
    assert.ok(atBlink.mouthSmileRight > 0.3);
    assert.ok(Math.abs(atBlink.mouthSmileLeft - atBlink.mouthSmileRight) < 0.05);
    assert.ok(atBlink.browDownLeft < 0.1);
    assert.ok(atBlink.eyeBlinkLeft > 0);
    assert.equal(atBlink.noseSneerLeft, 0);
  });

  it("Sarcastic produces asymmetric smile and raised eyebrow", () => {
    const brow = resolveKarenExpression({
      mood: "sarcastic",
      intensity: 3,
      faceCue: "raised_eyebrow",
      presence: "listening",
      animationPhase: 0,
    });
    assertAllInRange(brow);
    assert.ok(brow.browOuterUpLeft > brow.browOuterUpRight);
    assert.ok(brow.mouthSmileLeft > brow.mouthSmileRight);

    const smirk = resolveKarenExpression({
      mood: "sarcastic",
      intensity: 5,
      faceCue: "smirk",
      presence: "listening",
      animationPhase: 0,
    });
    assertAllInRange(smirk);
    assert.ok(smirk.mouthSmileLeft > smirk.mouthSmileRight + 0.15);
    assert.ok(smirk.mouthDimpleLeft > 0);
  });

  it("Annoyed narrows eyes, lowers brows, and eye-rolls on phase window", () => {
    const base = resolveKarenExpression({
      mood: "annoyed",
      intensity: 3,
      faceCue: "eye_roll",
      presence: "listening",
      animationPhase: 0,
    });
    assertAllInRange(base);
    assert.ok(base.browDownLeft > 0.2);
    assert.ok(base.eyeSquintLeft > 0.15);
    assert.equal(base.eyeLookUpLeft, 0);

    const rolled = resolveKarenExpression({
      mood: "annoyed",
      intensity: 3,
      faceCue: "eye_roll",
      presence: "listening",
      animationPhase: 0.47,
    });
    assertAllInRange(rolled);
    assert.ok(rolled.eyeLookUpLeft > 0.2);
    assert.ok(rolled.eyeLookUpRight > 0.2);
  });

  it("Furious produces strong brow tension, frown, and mouth opening on shout", () => {
    const glare = resolveKarenExpression({
      mood: "furious",
      intensity: 3,
      faceCue: "glare",
      presence: "listening",
      animationPhase: 0,
    });
    assertAllInRange(glare);
    assert.ok(glare.browDownLeft > 0.5);
    assert.ok(glare.mouthFrownLeft > 0.3);
    assert.ok(glare.noseSneerLeft > 0.2);

    const shout = resolveKarenExpression({
      mood: "furious",
      intensity: 5,
      faceCue: "shouting",
      presence: "listening",
      animationPhase: 0,
    });
    assertAllInRange(shout);
    assert.ok(shout.jawOpen > 0.4);
    assert.ok(shout.mouthStretchLeft > 0.2);
  });

  it("Intensity scales expression strength", () => {
    const low = resolveKarenExpression({
      mood: "sweet",
      intensity: 1,
      faceCue: "smile",
      animationPhase: 0,
    });
    const high = resolveKarenExpression({
      mood: "sweet",
      intensity: 5,
      faceCue: "smile",
      animationPhase: 0,
    });
    assert.ok(high.mouthSmileLeft > low.mouthSmileLeft);
  });

  it("Speaking changes jaw-related values from animation phase", () => {
    const closed = resolveKarenExpression({
      mood: "sweet",
      intensity: 3,
      faceCue: "smile",
      presence: "speaking",
      animationPhase: 0,
    });
    const open = resolveKarenExpression({
      mood: "sweet",
      intensity: 3,
      faceCue: "smile",
      presence: "speaking",
      animationPhase: 0.25,
    });
    assertAllInRange(closed);
    assertAllInRange(open);
    assert.ok(open.jawOpen > closed.jawOpen);
    assert.ok(jawFromPhase(0.25, 1) > 0.9);
  });

  it("Listening produces neutral/idle values for neutral cue", () => {
    const idle = resolveKarenExpression({
      mood: "sweet",
      intensity: 2,
      faceCue: "neutral",
      presence: "listening",
      animationPhase: 0.015,
    });
    assertAllInRange(idle);
    assert.equal(idle.jawOpen, 0);
    assert.equal(idle.mouthFrownLeft, 0);
    assert.equal(idle.noseSneerLeft, 0);
    assert.ok(idle.eyeBlinkLeft > 0);
    assert.ok(blinkFromPhase(0.015) > 0);
  });

  it("Crisis and softened suppress aggressive / furious expressions", () => {
    const crisis = resolveKarenExpression({
      mood: "furious",
      intensity: 5,
      faceCue: "shouting",
      crisis: true,
      presence: "listening",
      animationPhase: 0,
    });
    assertAllInRange(crisis);
    assert.ok(crisis.mouthSmileLeft > 0);
    assert.equal(crisis.noseSneerLeft, 0);
    assert.ok(crisis.browDownLeft < 0.15);
    assert.ok(crisis.jawOpen < 0.2);

    const soft = resolveKarenExpression({
      mood: "furious",
      intensity: 5,
      faceCue: "softened",
      presence: "speaking",
      animationPhase: 0.25,
    });
    assertAllInRange(soft);
    assert.equal(soft.noseSneerLeft, 0);
    assert.ok(soft.mouthSmileLeft > soft.mouthFrownLeft);
    // Speaking still allowed under softened, but no furious brow stack.
    assert.ok(soft.browDownLeft < 0.15);
  });

  it("Missing cues and invalid inputs do not crash and stay neutral-safe", () => {
    const empty = resolveKarenExpression({});
    assertAllInRange(empty);
    assert.ok(empty.mouthSmileLeft >= 0);

    const junk = resolveKarenExpression({
      mood: "nope" as never,
      intensity: "x" as never,
      faceCue: "zzz" as never,
      presence: "dance" as never,
      animationPhase: Number.POSITIVE_INFINITY,
    });
    assertAllInRange(junk);

    const nullish = resolveKarenExpression({
      mood: null,
      intensity: null,
      faceCue: null,
      presence: null,
      animationPhase: null,
      crisis: null,
    });
    assertAllInRange(nullish);
  });

  it("is deterministic for the same inputs", () => {
    const a = resolveKarenExpression({
      mood: "annoyed",
      intensity: 4,
      faceCue: "glare",
      presence: "speaking",
      animationPhase: 0.33,
    });
    const b = resolveKarenExpression({
      mood: "annoyed",
      intensity: 4,
      faceCue: "glare",
      presence: "speaking",
      animationPhase: 0.33,
    });
    assert.deepEqual(a, b);
    assert.ok(nonZeroBlendshapes(a).length > 0);
  });
});
