import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FALLBACK_BRUTAL_WAVS,
  SMACKBACK_PRELOAD_COUNT,
  listFallbackBrutalUrls,
  listPreloadSmackbackUrls,
} from "./audio-cache";

describe("audio-cache preloader", () => {
  it("lists 20 combat-priority smackback URLs with fallbacks first", () => {
    assert.equal(SMACKBACK_PRELOAD_COUNT, 20);
    const urls = listPreloadSmackbackUrls();
    assert.equal(urls.length, 20);
    for (const u of urls) {
      assert.match(u, /\/audio\/smackbacks\//);
    }
    // Top 10 brutal/fallback/interrupt land first — typo "asdf" never waits.
    const fallbacks = listFallbackBrutalUrls();
    assert.equal(fallbacks.length, 10);
    assert.equal(FALLBACK_BRUTAL_WAVS.length, 10);
    for (const priority of FALLBACK_BRUTAL_WAVS) {
      assert.ok(urls.includes(priority), `missing fallback ${priority}`);
    }
    assert.equal(urls[0], FALLBACK_BRUTAL_WAVS[0]);
  });
});
