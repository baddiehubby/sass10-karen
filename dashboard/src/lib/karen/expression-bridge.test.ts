/**
 * Compatibility suite — canonical tests live in lib/karen/expression-bridge.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getBlendshapes,
  parseMoodTag,
  type ArkitBlendshapes,
  type KarenExpressionMood,
} from "./expression-bridge";

function assertAllInRange(shapes: ArkitBlendshapes) {
  for (const [k, v] of Object.entries(shapes)) {
    assert.ok(typeof v === "number" && v >= 0 && v <= 1, `${k}=${v}`);
  }
}

describe("getBlendshapes — re-export bridge", () => {
  it("ANGRY rage brows without locking jaw", () => {
    const s = getBlendshapes("ANGRY", false, 0);
    assertAllInRange(s);
    assert.equal(s.browDownLeft, 1);
    assert.equal(s.jawOpen, 0);
    assert.ok(s.eyeWideLeft >= 0.85);
  });

  it("parses tags", () => {
    assert.equal(parseMoodTag("[PROUD] Nice."), "PROUD");
  });

  it("covers moods", () => {
    const moods: KarenExpressionMood[] = [
      "SWEET",
      "SARCASTIC",
      "ANNOYED",
      "ANGRY",
      "FURIOUS",
      "PROUD",
    ];
    for (const mood of moods) {
      assertAllInRange(getBlendshapes(mood, false, 0));
      assertAllInRange(getBlendshapes(mood, true, 40));
    }
  });
});
