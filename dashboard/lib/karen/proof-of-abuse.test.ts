import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PROOF_OF_ABUSE_SIZE,
  PROOF_OF_ABUSE_WATERMARK,
  SHARE_CARD_DOM_ID,
  checkInAbuseLine,
  checkInAbuseTitle,
  prefersNativeShareSheet,
} from "./proof-of-abuse";

describe("proof-of-abuse / share-card", () => {
  it("watermarks SASS10.com", () => {
    assert.equal(PROOF_OF_ABUSE_WATERMARK, "Get roasted at SASS10.com");
  });

  it("exports a 320×480 poster with a stable DOM id", () => {
    assert.equal(PROOF_OF_ABUSE_SIZE.width, 320);
    assert.equal(PROOF_OF_ABUSE_SIZE.height, 480);
    assert.equal(SHARE_CARD_DOM_ID, "share-card");
  });

  it("titles check-in failures as cowardly", () => {
    assert.match(checkInAbuseTitle(false, 10), /COWARD|DISAPPOINTMENT|EXCUSE/i);
  });

  it("mentions the goal in the share line", () => {
    assert.match(checkInAbuseLine(true, "Go to the gym"), /Go to the gym/);
  });

  it("prefers download when Web Share is unavailable", () => {
    assert.equal(prefersNativeShareSheet(), false);
  });
});
