import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AFTERNOON_NUDGE_BODY,
  AFTERNOON_NUDGE_SPEECH,
  isAfternoonNudgeHour,
  urlRequestsAfternoonNudge,
} from "./afternoon-nudge";

describe("afternoon hostile nudge", () => {
  it("uses the scrolling taunt + get back to work line", () => {
    assert.match(AFTERNOON_NUDGE_BODY, /scrolling/i);
    assert.equal(AFTERNOON_NUDGE_SPEECH, "Get back to work. Now.");
  });

  it("detects 2:00 PM", () => {
    assert.equal(isAfternoonNudgeHour(new Date(2026, 10, 16, 14, 0, 0)), true);
    assert.equal(isAfternoonNudgeHour(new Date(2026, 10, 16, 14, 1, 0)), false);
  });

  it("parses afternoonNudge query", () => {
    assert.equal(urlRequestsAfternoonNudge("?afternoonNudge=1"), true);
  });
});
