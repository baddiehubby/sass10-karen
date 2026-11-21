import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SHARE_DEFEAT_HEADLINE,
  SHARE_DEFEAT_SIZE,
  SHARE_DEFEAT_TAGLINE,
  SHARE_DEFEAT_WATERMARK,
  defeatScoresFromRespect,
  formatDefeatScoreLine,
} from "./share-defeat";

describe("share-defeat card", () => {
  it("burns SASS10.app watermark and TikTok-sized canvas", () => {
    assert.equal(SHARE_DEFEAT_WATERMARK, "SASS10.app");
    assert.equal(SHARE_DEFEAT_SIZE.width, 320);
    assert.equal(SHARE_DEFEAT_SIZE.height, 568);
    assert.match(SHARE_DEFEAT_HEADLINE, /I TRIED TO FIGHT KAREN/i);
    assert.match(SHARE_DEFEAT_TAGLINE, /She muted me\. 10\/10/i);
  });

  it("formats the smash scoreboard", () => {
    assert.equal(
      formatDefeatScoreLine({ karen: 5, me: 0 }),
      "KAREN: 5 | ME: 0",
    );
  });

  it("defaults to Karen 5 — Me 0 when respect is missing", () => {
    assert.deepEqual(defeatScoresFromRespect(null), { karen: 5, me: 0 });
    assert.equal(defeatScoresFromRespect(-40).me, 0);
    assert.ok(defeatScoresFromRespect(-40).karen >= 5);
  });
});
