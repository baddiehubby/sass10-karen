import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { chunkSpeechText } from "./voice";

describe("voice — speech chunking", () => {
  it("splits on sentence boundaries", () => {
    const chunks = chunkSpeechText("Get up. Now. Move!");
    assert.ok(chunks.length >= 2);
    assert.ok(chunks[0]!.includes("Get up"));
  });

  it("returns single chunk for short blurts", () => {
    const chunks = chunkSpeechText("Fine.");
    assert.equal(chunks.length, 1);
  });

  it("handles empty", () => {
    assert.deepEqual(chunkSpeechText("   "), []);
  });
});
