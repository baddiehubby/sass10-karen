import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FIGHT_CHAOS_DIGNITY_THRESHOLD,
  FIGHT_DIGNITY_HIT,
  FIGHT_DIGNITY_START,
  FIGHT_PATIENCE_HIT,
  FIGHT_PATIENCE_MUTE_MS,
  FIGHT_PATIENCE_START,
} from "@/components/karen/fight-meters";

describe("fight meters tuning", () => {
  it("starts both bars at 100", () => {
    assert.equal(FIGHT_PATIENCE_START, 100);
    assert.equal(FIGHT_DIGNITY_START, 100);
  });

  it("landed scream is 10+ and Karen WAV counter is 20+", () => {
    assert.equal(FIGHT_PATIENCE_HIT, 10);
    assert.equal(FIGHT_DIGNITY_HIT, 20);
    assert.ok(FIGHT_DIGNITY_HIT > FIGHT_PATIENCE_HIT);
  });

  it("chaos below 30 Dignity; mute window still 30s for protocol", () => {
    assert.equal(FIGHT_PATIENCE_MUTE_MS, 30_000);
    assert.equal(FIGHT_CHAOS_DIGNITY_THRESHOLD, 30);
  });
});
