import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import audioManifest from "@/data/audio-manifest.json";
import {
  clearRecentWavs,
  getKeywordPool,
  keywordFilePool,
  listCategoryClips,
  pickCategoryClip,
  pickFreshWav,
  readRecentWavs,
  rememberPlayedWav,
  resetAudioRouterMemory,
  RECENT_WAV_LIMIT,
} from "./audio-router";
import { pickTalkInterrupt, processUserScream } from "./smack-back";

describe("audio-manifest v2 categories", () => {
  it("ships keyword arrays + combat categories including brutal lectures", () => {
    const m = audioManifest as {
      version: number;
      keywords: Record<string, string | string[]>;
      categories: Record<string, unknown[]>;
    };
    assert.ok(m.version >= 2);
    assert.ok(Object.keys(m.keywords).length > 100);
    assert.ok(Array.isArray(m.keywords.stupid));
    assert.ok((m.keywords.stupid as string[]).length >= 2);
    assert.ok(Array.isArray(m.keywords.coward));
    for (const cat of [
      "smackbacks",
      "interrupts",
      "mute",
      "gaslight",
      "rage",
      "tiktok_viral",
      "brutal",
    ]) {
      assert.ok(Array.isArray(m.categories[cat]), cat);
      assert.ok((m.categories[cat] as unknown[]).length > 0, cat);
    }
  });
});

describe("pickFreshWav no-repeat", () => {
  beforeEach(() => {
    resetAudioRouterMemory();
    clearRecentWavs();
  });

  it("re-rolls away from the last 10 played", () => {
    const pool = [
      "smackbacks/a.wav",
      "smackbacks/b.wav",
      "smackbacks/c.wav",
    ];
    const store = {
      map: new Map<string, string>(),
      getItem(k: string) {
        return this.map.get(k) ?? null;
      },
      setItem(k: string, v: string) {
        this.map.set(k, v);
      },
    };

    rememberPlayedWav(pool[0]!, store);
    rememberPlayedWav(pool[1]!, store);

    // Always roll index 0 of candidates — with a+b recent, fresh is only c
    const pick = pickFreshWav(pool, { rng: () => 0, store });
    assert.equal(pick, "smackbacks/c.wav");
    assert.ok(readRecentWavs(store).includes("smackbacks/c.wav"));
  });

  it("caps recent history at 10", () => {
    const store = {
      map: new Map<string, string>(),
      getItem(k: string) {
        return this.map.get(k) ?? null;
      },
      setItem(k: string, v: string) {
        this.map.set(k, v);
      },
    };
    for (let i = 0; i < 15; i++) {
      rememberPlayedWav(`smackbacks/x_${i}.wav`, store);
    }
    assert.equal(readRecentWavs(store).length, RECENT_WAV_LIMIT);
  });

  it("exposes keyword pools as arrays", () => {
    const pool = getKeywordPool("stupid");
    assert.ok(pool.length >= 2);
    assert.deepEqual(keywordFilePool(pool[0]!), [pool[0]]);
  });
});

describe("interrupt category routing", () => {
  beforeEach(() => {
    resetAudioRouterMemory();
    clearRecentWavs();
  });

  it("picks talk interrupts from the category pool", () => {
    const clips = listCategoryClips("interrupts");
    assert.ok(clips.length >= 5);
    const pick = pickCategoryClip("interrupts", { rng: () => 0 });
    assert.ok(pick?.file);
    const result = pickTalkInterrupt(() => 0);
    assert.equal(result.volumeInterrupt, true);
    assert.match(result.src, /\/audio\//);
    assert.ok(result.text.length > 2);
  });

  it("processUserScream picks a file from the keyword array", () => {
    const r = processUserScream("you are stupid", () => 0.5);
    assert.ok(r.matchedKeywords?.includes("stupid"));
    assert.match(r.src, /\/audio\/smackbacks\//);
  });
});
