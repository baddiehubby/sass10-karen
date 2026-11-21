import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyDynamicInserts,
  audioBankStats,
  lookupQuestionClip,
  lookupRoastClip,
  resolveKarenSpeech,
} from "./audio-bank";
import { ANSWER_ROASTS } from "./roasts";

describe("audio-bank", () => {
  it("ships mapped premium lines for the 9-question ladder", () => {
    const { total, byKind } = audioBankStats();
    assert.ok(total >= 90);
    assert.equal(byKind.question, 9);
    // 9 questions × 3 answers × 3 ladder levels
    assert.equal(byKind.roast, 81);
  });

  it("maps gym answer roasts to bank mp3 paths", () => {
    const line = ANSWER_ROASTS.q1_gym!.a![0]!;
    const clip = lookupRoastClip("q1_gym", "a", line);
    assert.equal(clip?.src, "/audio/bank/roasts/q1_gym_a_0.mp3");
    assert.equal(clip?.kind, "roast");
  });

  it("resolves questions without TTS when no dynamic inserts", () => {
    const q = lookupQuestionClip("q1_gym");
    assert.ok(q);
    const resolved = resolveKarenSpeech({
      text: q!.text,
      questionId: "q1_gym",
    });
    assert.equal(resolved.useTts, false);
    assert.equal(resolved.src, "/audio/bank/questions/q1_gym.mp3");
  });

  it("forces TTS for dynamic goal inserts", () => {
    const { text, needsTts } = applyDynamicInserts(
      "You skipped {{goal}}. Of course you did.",
      { goal: "leg day" },
    );
    assert.ok(text.includes("leg day"));
    assert.equal(needsTts, true);

    const resolved = resolveKarenSpeech({
      text: "You skipped {{goal}}. Of course you did.",
      dynamic: { goal: "leg day" },
    });
    assert.equal(resolved.useTts, true);
    assert.equal(resolved.src, null);
    assert.equal(resolved.text, "You skipped leg day. Of course you did.");
  });
});
