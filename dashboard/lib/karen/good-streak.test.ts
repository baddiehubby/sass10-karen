import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GOOD_STREAK_THRESHOLD,
  PROUD_RESPONSES,
  checkInMoodForStreak,
  isPraiseUnlocked,
  pickProudResponse,
} from "./good-streak";

describe("good streak / praise mode", () => {
  it("unlocks praise at 7 days", () => {
    assert.equal(GOOD_STREAK_THRESHOLD, 7);
    assert.equal(isPraiseUnlocked(6), false);
    assert.equal(isPraiseUnlocked(7), true);
    assert.equal(checkInMoodForStreak(true, 7), "PROUD");
    assert.equal(checkInMoodForStreak(true, 3), "SARCASTIC");
    assert.equal(checkInMoodForStreak(false, 99), "FURIOUS");
  });

  it("has 5 proud responses", () => {
    assert.equal(PROUD_RESPONSES.length, 5);
    assert.match(PROUD_RESPONSES[0]!, /not a total failure/i);
    assert.match(pickProudResponse(() => 0), /not a total failure/i);
  });
});
