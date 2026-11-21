import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { GOOD_STREAK_LAST_DAY_KEY, writeGoodStreak } from "./good-streak";
import {
  _resetRetentionForTests,
  apologyAccepted,
  applyCheckInOutcome,
  applyForgiveness,
  isColdShoulder,
  isRareRoastUnlocked,
  readRespect,
  RESPECT_COLD_SHOULDER,
  RESPECT_NO_DELTA,
  RESPECT_YES_DELTA,
  RARE_ROAST_STREAK,
} from "./state";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  (globalThis as unknown as { window: { localStorage: typeof localStorage } }).window = {
    localStorage,
  };
}

describe("karen retention state", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    _resetRetentionForTests();
  });

  it("starts Respect at 0 and awards YES / punishes NO", () => {
    assert.equal(readRespect(), 0);
    const yes = applyCheckInOutcome(true);
    assert.equal(yes.respect, RESPECT_YES_DELTA);
    assert.equal(yes.streak, 1);

    _resetRetentionForTests();
    const no = applyCheckInOutcome(false);
    assert.equal(no.respect, RESPECT_NO_DELTA);
    assert.equal(no.streak, 0);
  });

  it("cold-shoulders at Respect ≤ -50", () => {
    applyCheckInOutcome(false);
    applyCheckInOutcome(false);
    applyCheckInOutcome(false);
    const last = applyCheckInOutcome(false);
    assert.ok(last.respect <= RESPECT_COLD_SHOULDER);
    assert.equal(isColdShoulder(last.respect), true);
  });

  it("unlocks rare roast on the 3rd consecutive YES", () => {
    writeGoodStreak(RARE_ROAST_STREAK - 1);
    window.localStorage.setItem(GOOD_STREAK_LAST_DAY_KEY, "1999-01-01");
    const outcome = applyCheckInOutcome(true);
    assert.equal(outcome.streak, RARE_ROAST_STREAK);
    assert.equal(outcome.rareRoastJustUnlocked, true);
    assert.equal(isRareRoastUnlocked(outcome.streak), true);
  });

  it("accepts apology transcripts with sorry / I will", () => {
    assert.equal(apologyAccepted("I'm sorry Karen, I will do better"), true);
    assert.equal(apologyAccepted("I will try again"), true);
    assert.equal(apologyAccepted("whatever"), false);
  });

  it("forgiveness bumps Respect", () => {
    applyCheckInOutcome(false);
    const before = readRespect();
    const after = applyForgiveness();
    assert.ok(after.respect > before);
  });
});
