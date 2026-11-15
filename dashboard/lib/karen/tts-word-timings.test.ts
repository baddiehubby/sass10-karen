import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildWordTimings, tokenizeSpeechWords } from "./tts-word-timings";

describe("tts-word-timings", () => {
  it("tokenizes words", () => {
    assert.deepEqual(tokenizeSpeechWords("Get. Up now!"), ["Get.", "Up", "now!"]);
  });

  it("builds timings that fit duration", () => {
    const t = buildWordTimings("Get up now", 1200);
    assert.equal(t.words.length, 3);
    assert.equal(t.wtimes.length, 3);
    assert.equal(t.wdurations.length, 3);
    const end = t.wtimes[2]! + t.wdurations[2]!;
    assert.ok(end <= 1400);
    assert.ok(t.wtimes[0]! >= 0);
  });
});
