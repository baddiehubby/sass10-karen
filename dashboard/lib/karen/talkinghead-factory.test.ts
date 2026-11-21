import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  KAREN_CAMERA_LOOK_UP,
  KAREN_HEMI_INTENSITY,
  KAREN_KEY_INTENSITY,
  KAREN_MAX_PIXEL_RATIO,
  KAREN_PORTRAIT_CAM,
  KAREN_RIM_INTENSITY,
  KAREN_TONE_EXPOSURE,
  karenClampedPixelRatio,
  karenModelPixelRatioOption,
} from "./talkinghead-factory";

describe("talkinghead-factory — interrogation lighting", () => {
  it("uses soft key + red rim with crushed ACES exposure (no ghost wash)", () => {
    assert.equal(KAREN_KEY_INTENSITY, 0.5);
    assert.equal(KAREN_HEMI_INTENSITY, 0);
    assert.equal(KAREN_RIM_INTENSITY, 2.0);
    assert.equal(KAREN_TONE_EXPOSURE, 0.8);
  });

  it("places the camera below the look-at for a dominant angle", () => {
    assert.equal(KAREN_PORTRAIT_CAM.position.y, 1.3);
    assert.equal(KAREN_PORTRAIT_CAM.lookAt.y, 1.5);
    assert.ok(KAREN_PORTRAIT_CAM.position.y < KAREN_PORTRAIT_CAM.lookAt.y);
    assert.equal(KAREN_CAMERA_LOOK_UP, 0.2);
  });
});

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
