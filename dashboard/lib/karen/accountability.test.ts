import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CHECKIN_NO_LINE,
  CHECKIN_YES_LINE,
  defaultAccountabilityState,
  isPastEveningCheckInHour,
  primaryCheckInQuestion,
  shouldActivateEveningCheckIn,
  sanitizeAccountabilityState,
  COMMITMENT_MAX_LEN,
  MAIN_GOAL_MAX_LEN,
  type AccountabilityState,
} from "./accountability";

describe("accountability loop", () => {
  it("exposes the scripted YES / NO lines", () => {
    assert.match(CHECKIN_YES_LINE, /actually did it/i);
    assert.match(CHECKIN_NO_LINE, /coward/i);
  });

  it("detects evening hour", () => {
    const evening = new Date(2026, 10, 16, 20, 0, 0);
    const morning = new Date(2026, 10, 16, 10, 0, 0);
    assert.equal(isPastEveningCheckInHour(evening), true);
    assert.equal(isPastEveningCheckInHour(morning), false);
  });

  it("activates check-in only after 8 PM with goals and no completion", () => {
    const state: AccountabilityState = {
      ...defaultAccountabilityState("2026-11-16"),
      day: "2026-11-16",
      goals: { gym: true, work: false, sleep: false },
      checkInCompletedDay: null,
    };
    const evening = new Date(2026, 10, 16, 20, 5, 0);
    const morning = new Date(2026, 10, 16, 11, 0, 0);
    assert.equal(shouldActivateEveningCheckIn(state, evening), true);
    assert.equal(shouldActivateEveningCheckIn(state, morning), false);
    assert.equal(
      shouldActivateEveningCheckIn(
        { ...state, checkInCompletedDay: "2026-11-16" },
        evening,
      ),
      false,
    );
  });

  it("activates from Goal Tracker commitment", () => {
    const state: AccountabilityState = {
      ...defaultAccountabilityState("2026-11-16"),
      commitment: "Go to the gym",
      checkInCompletedDay: null,
    };
    const evening = new Date(2026, 10, 16, 20, 0, 0);
    assert.equal(shouldActivateEveningCheckIn(state, evening), true);
    const q = primaryCheckInQuestion(state);
    assert.equal(q.id, "custom");
    assert.match(q.question, /Go to the gym/i);
  });

  it("asks gym first when selected (legacy)", () => {
    const q = primaryCheckInQuestion({ gym: true, work: true, sleep: false });
    assert.equal(q.id, "gym");
    assert.match(q.question, /gym/i);
  });
});

describe("sanitizeAccountabilityState (untrusted input)", () => {
  it("returns safe defaults for garbage input", () => {
    for (const bad of [null, undefined, 42, "x", [], {}]) {
      const s = sanitizeAccountabilityState(bad, "2026-11-18");
      assert.equal(s.day, "2026-11-18");
      assert.equal(s.mainGoal, "");
      assert.equal(s.commitment, "");
      assert.equal(s.wakeUpTime, "07:00");
      assert.equal(s.checkInCompletedDay, null);
      assert.deepEqual(s.goals, { gym: false, work: false, sleep: false });
    }
  });

  it("caps oversized text so a direct server-action call can't bloat the DB row", () => {
    const s = sanitizeAccountabilityState({
      mainGoal: "x".repeat(1_000_000),
      commitment: `  ${"y".repeat(1_000_000)}  `,
    });
    assert.equal(s.mainGoal.length, MAIN_GOAL_MAX_LEN);
    assert.equal(s.commitment.length, COMMITMENT_MAX_LEN);
  });

  it("rejects impossible clock times and malformed day keys", () => {
    const s = sanitizeAccountabilityState(
      { wakeUpTime: "99:99", day: "yesterday", checkInCompletedDay: "nope" },
      "2026-11-18",
    );
    assert.equal(s.wakeUpTime, "07:00");
    assert.equal(s.day, "2026-11-18");
    assert.equal(s.checkInCompletedDay, null);
  });

  it("keeps valid values and coerces goal flags to booleans", () => {
    const s = sanitizeAccountabilityState({
      day: "2026-11-17",
      mainGoal: " Ship it ",
      wakeUpTime: "05:30",
      commitment: "Go to the gym",
      checkInCompletedDay: "2026-11-17",
      goals: { gym: 1, work: "", sleep: true },
    });
    assert.equal(s.mainGoal, "Ship it");
    assert.equal(s.wakeUpTime, "05:30");
    assert.equal(s.checkInCompletedDay, "2026-11-17");
    assert.deepEqual(s.goals, { gym: true, work: false, sleep: true });
  });
});
