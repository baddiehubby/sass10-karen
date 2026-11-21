import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allPremiumRoastUrls,
  moodToPremiumVoiceBucket,
  pickPremiumRoastUrl,
} from "./premium-voice-library";

describe("premium voice library", () => {
  it("exposes 20 roast MP3 paths", () => {
    assert.equal(allPremiumRoastUrls().length, 20);
    assert.ok(allPremiumRoastUrls().every((u) => u.startsWith("/audio/roasts/")));
  });

  it("maps moods to buckets and picks a file", () => {
    assert.equal(moodToPremiumVoiceBucket("FURIOUS"), "angry");
    assert.equal(moodToPremiumVoiceBucket("PROUD"), "proud");
    assert.equal(moodToPremiumVoiceBucket("SARCASTIC"), "sarcastic");
    assert.match(pickPremiumRoastUrl("ANGRY", () => 0), /angry_01\.mp3$/);
    assert.match(pickPremiumRoastUrl("PROUD", () => 0), /proud_01\.mp3$/);
  });
});
