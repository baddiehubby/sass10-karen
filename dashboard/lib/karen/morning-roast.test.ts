import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MORNING_ROAST_LINE,
  MORNING_ROAST_SPEECH_RATE,
  isMorningRoastHour,
  urlRequestsMorningRoast,
} from "./morning-roast";

describe("morning roast", () => {
  it("uses the dying-dreams line and urgent rate", () => {
    assert.match(MORNING_ROAST_LINE, /dreams are dying/i);
    assert.equal(MORNING_ROAST_SPEECH_RATE, 1.3);
  });

  it("detects 7:00 AM local", () => {
    assert.equal(isMorningRoastHour(new Date(2026, 10, 16, 7, 0, 0)), true);
    assert.equal(isMorningRoastHour(new Date(2026, 10, 16, 7, 1, 0)), false);
  });

  it("parses morningRoast query", () => {
    assert.equal(urlRequestsMorningRoast("?morningRoast=1"), true);
    assert.equal(urlRequestsMorningRoast("?challenge=94"), false);
  });
});
