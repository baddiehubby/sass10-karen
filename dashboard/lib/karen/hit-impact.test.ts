import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hitPosePeak } from "./hit-impact";

describe("hit pose armature throw", () => {
  it("scream pitches the head forward (positive X)", () => {
    assert.ok(hitPosePeak(0, "scream") > 0);
    assert.ok(hitPosePeak(0.12, "scream") > 0.12);
  });

  it("laugh throws the head back (negative X)", () => {
    assert.ok(hitPosePeak(0, "laugh") < 0);
    assert.ok(hitPosePeak(0.12, "laugh") < 0.12);
  });
});
