import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyExpressionToTalkingHead,
  getBlendshapes,
  parseMoodTag,
  speakingJawOpen,
  stripMoodTags,
  type ArkitBlendshapes,
  type KarenExpressionMood,
  type TalkingHeadLike,
} from "./expression-bridge";

function assertAllInRange(shapes: ArkitBlendshapes) {
  for (const [k, v] of Object.entries(shapes)) {
    assert.ok(typeof v === "number" && v >= 0 && v <= 1, `${k}=${v}`);
  }
}

describe("expression-bridge — TalkingHead mood map", () => {
  it("parses [ANGRY] mood tags from Ollama text", () => {
    assert.equal(parseMoodTag("[ANGRY] Get up now."), "ANGRY");
    assert.equal(parseMoodTag("Nice try. [SARCASTIC]"), "SARCASTIC");
    assert.equal(parseMoodTag("no tag here"), null);
  });

  it("strips mood tags for display / TTS", () => {
    assert.equal(stripMoodTags("[PROUD] You did it."), "You did it.");
  });

  it("ANGRY sets browDown + eyeWide without locking jaw (lipsync owns mouth)", () => {
    const s = getBlendshapes("ANGRY", false, 0);
    assertAllInRange(s);
    assert.equal(s.browDownLeft, 1);
    assert.equal(s.browDownRight, 1);
    assert.equal(s.jawOpen, 0);
    assert.ok(s.eyeWideLeft >= 0.85);
    assert.ok(s.eyeWideRight >= 0.85);
  });

  it("SARCASTIC smirk + head tilt", () => {
    const s = getBlendshapes("SARCASTIC", false, 0);
    assertAllInRange(s);
    assert.equal(s.mouthSmileLeft, 0.8);
    assert.ok(s.mouthSmileLeft > s.mouthSmileRight);
    assert.ok(s.bodyRotateZ > 0);
  });

  it("PROUD relaxes brows with a slight smile", () => {
    const s = getBlendshapes("PROUD", false, 0);
    assertAllInRange(s);
    assert.equal(s.browDownLeft, 0);
    assert.equal(s.browDownRight, 0);
    assert.ok(s.mouthSmileLeft > 0.3 && s.mouthSmileLeft < 0.55);
  });

  it("applies setMood + blendshape baselines on TalkingHead", () => {
    const calls: Array<[string, number | null]> = [];
    let mood = "";
    const head: TalkingHeadLike = {
      setMood: (m) => {
        mood = m;
      },
      setBaselineValue: (mt, val) => {
        calls.push([mt, val]);
      },
    };
    applyExpressionToTalkingHead(head, "ANGRY");
    assert.equal(mood, "angry");
    assert.ok(calls.some(([n, v]) => n === "browDownLeft" && v === 1));
    assert.ok(calls.some(([n, v]) => n === "jawOpen" && v === 0));
    assert.ok(calls.some(([n]) => n === "eyeWideLeft"));
  });

  it("isSpeaking no longer fakes jaw (ElevenLabs audio drives mouth)", () => {
    const a = getBlendshapes("SWEET", true, 0);
    const b = getBlendshapes("SWEET", true, 180);
    assert.equal(a.jawOpen, 0);
    assert.equal(b.jawOpen, 0);
    assert.ok(speakingJawOpen(0) > 0); // helper retained for legacy
  });

  it("invalid mood falls back safely", () => {
    const s = getBlendshapes("NOPE" as KarenExpressionMood, false, 0);
    assertAllInRange(s);
  });
});
