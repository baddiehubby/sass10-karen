import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  IM_TALKING_LINE,
  MIC_HOLD_INTERRUPT_DIGNITY,
  MIC_HOLD_INTERRUPT_MS,
  MIC_PRESS_TALKING_CHANCE,
  MIC_RELEASE_MUTE_CHANCE,
  MIC_RELEASE_MUTE_LOCK_MS,
  MIC_TALKING_LOCK_MS,
  rollMicPressTalkingDenial,
  rollMicReleaseMute,
} from "./mic";

describe("mic toggle abuse", () => {
  it("locks 5s on talking denial and 10s on release mute", () => {
    assert.equal(MIC_TALKING_LOCK_MS, 5_000);
    assert.equal(MIC_RELEASE_MUTE_LOCK_MS, 10_000);
    assert.equal(MIC_HOLD_INTERRUPT_MS, 3_000);
    assert.equal(MIC_HOLD_INTERRUPT_DIGNITY, 10);
    assert.equal(IM_TALKING_LINE, "No. I'm talking.");
  });

  it("rolls ~30% press denial and ~20% release mute", () => {
    assert.equal(MIC_PRESS_TALKING_CHANCE, 0.3);
    assert.equal(MIC_RELEASE_MUTE_CHANCE, 0.2);
    assert.equal(rollMicPressTalkingDenial(() => 0.29), true);
    assert.equal(rollMicPressTalkingDenial(() => 0.3), false);
    assert.equal(rollMicReleaseMute(() => 0.19), true);
    assert.equal(rollMicReleaseMute(() => 0.2), false);
  });
});
