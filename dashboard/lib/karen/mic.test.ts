import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isScreamMicSupported } from "./mic";

describe("scream mic", () => {
  it("reports unsupported outside a browser SpeechRecognition env", () => {
    // Node test runner — no webkitSpeechRecognition.
    assert.equal(isScreamMicSupported(), false);
  });
});
