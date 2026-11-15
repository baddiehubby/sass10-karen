import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  KAREN_MAX_PIXEL_RATIO,
  karenClampedPixelRatio,
  karenModelPixelRatioOption,
} from "./talkinghead-factory";

describe("talkinghead-factory — pixel ratio clamp", () => {
  it("clamps DPR to max 1.5", () => {
    assert.equal(karenClampedPixelRatio(1), 1);
    assert.equal(karenClampedPixelRatio(1.5), 1.5);
    assert.equal(karenClampedPixelRatio(2), KAREN_MAX_PIXEL_RATIO);
    assert.equal(karenClampedPixelRatio(3), KAREN_MAX_PIXEL_RATIO);
  });

  it("pre-divides modelPixelRatio so TalkingHead product ≤ 1.5", () => {
    // TalkingHead: setPixelRatio(modelPixelRatio * devicePixelRatio)
    for (const dpr of [1, 1.25, 1.5, 2, 2.25, 3]) {
      const opt = karenModelPixelRatioOption(dpr);
      const effective = opt * dpr;
      assert.ok(
        Math.abs(effective - karenClampedPixelRatio(dpr)) < 1e-9,
        `dpr=${dpr} → effective=${effective}`,
      );
      assert.ok(effective <= KAREN_MAX_PIXEL_RATIO + 1e-9);
    }
  });
});
