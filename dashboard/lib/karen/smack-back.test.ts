import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertSmackBackPolicySafe,
  containsProfanity,
  getAudioForKeyword,
  getSmackBack,
  getVolumeInterrupt,
  getWinResult,
  isActionBasedRoastText,
  isApologyTranscript,
  isLogicalGaslightTranscript,
  hasTypoDisrespect,
  OPENING_ROAST_LINE,
  OPENING_ROAST_SRC,
  pickBrutalCombatResult,
  pickCombatInterrupt,
  pickTypoDisrespectFallback,
  processUserScream,
  resolveSmackbackSrc,
  rollUserWin,
  SCREAM_RESPECT_DELTA,
  SMACKBACK_CLIPS,
  SMACK_BACK_CHAOS_DELTA,
  SMACK_BACK_PROCESS_MS,
  TYPO_DISRESPECT_LINES,
  VOLUME_INTERRUPT_LINE,
  WIN_CHANCE,
  WIN_LINE,
  WIN_SRC,
} from "./smack-back";
import { USER_KO_LINE, USER_KO_SRC } from "./game-state";

/** Avoid the 10% WIN roll in deterministic combat tests. */
const noWin = () => 0.5;

describe("processUserScream", () => {
  it("matches multiple keywords aggressively (stupid + robot)", () => {
    const r = processUserScream("You are a stupid robot", noWin);
    assert.equal(r.mood, "FURIOUS");
    assert.equal(r.dominanceFallback, undefined);
    assert.ok(r.matchedKeywords?.includes("stupid"));
    assert.ok(r.matchedKeywords?.includes("robot"));
    assert.match(r.src, /\/audio\/smackbacks\//);
    assert.equal(r.respectDelta, SCREAM_RESPECT_DELTA);
  });

  it("fires typo-disrespect fallback for um / uh / silence — never null", () => {
    for (const junk of ["um", "uh", "  ", "hmm", "uhh yeah"]) {
      const r = processUserScream(junk, noWin);
      assert.equal(r.dominanceFallback, true); // hesitate → 0 Patience
      assert.ok(r.src, "must always return a WAV src");
      assert.match(r.src, /\.(wav|mp3)(\?|$)/i);
      assert.equal(r.mood, "FURIOUS");
      assert.ok(
        TYPO_DISRESPECT_LINES.some((line) => r.text === line),
        `expected typo disrespect line, got: ${r.text}`,
      );
    }
  });

  it("typo near a keyword = disrespect (no fuzzy mercy)", () => {
    assert.equal(hasTypoDisrespect("stuppid robot"), true);
    const r = processUserScream("stuppid robot", noWin);
    assert.equal(r.mood, "FURIOUS");
    assert.equal(r.matchedKeywords, undefined);
    assert.ok(TYPO_DISRESPECT_LINES.includes(r.text as (typeof TYPO_DISRESPECT_LINES)[number]));
  });

  it("fires brutal disrespect when no keywords match — never freezes", () => {
    const r = processUserScream("purple elephant calculus Tuesday", noWin);
    assert.equal(r.dominanceFallback, undefined); // real phrase → scream-hit eligible
    assert.equal(r.mood, "FURIOUS");
    assert.ok(r.src);
    assert.ok(TYPO_DISRESPECT_LINES.includes(r.text as (typeof TYPO_DISRESPECT_LINES)[number]));
    assert.match(r.src, /sb_\d+\.wav|dominance_0[12]\.wav/i);
  });

  it("ships opening roast constants for ENTER THE ROAST", () => {
    assert.match(OPENING_ROAST_LINE, /spine/i);
    assert.match(OPENING_ROAST_SRC, /dominance_02\.wav$/);
    const clip = pickTypoDisrespectFallback(() => 0);
    assert.equal(clip.text, TYPO_DISRESPECT_LINES[0]);
  });

  it("barge-in interrupt is SHUT UP / EXCUSE ME on cache-hot WAVs", () => {
    const r = pickCombatInterrupt(() => 0);
    assert.equal(r.text, "SHUT UP!");
    assert.equal(r.volumeInterrupt, true);
    assert.match(r.src, /volume_interrupt\.wav$/);
    const r2 = pickCombatInterrupt(() => 0.5);
    assert.match(r2.text, /EXCUSE ME|SHUT UP/i);
  });

  it("matches shut-up bucket", () => {
    const r = processUserScream("shut up karen", noWin);
    assert.equal(r.mood, "FURIOUS");
    assert.ok((r.matchedKeywords?.length ?? 0) >= 1);
  });

  it("rolls a 10% WIN → DEFEATED + Share Victory unlock", () => {
    assert.equal(WIN_CHANCE, 0.1);
    assert.equal(rollUserWin(() => 0), true);
    assert.equal(rollUserWin(() => 0.5), false);
    const r = processUserScream("anything", () => 0);
    assert.equal(r.userWon, true);
    assert.equal(r.mood, "DEFEATED");
    assert.equal(r.text, WIN_LINE);
    assert.equal(getWinResult().userWon, true);
  });
});

describe("getSmackBack", () => {
  it("aliases processUserScream with chaos + respect deltas", () => {
    // getSmackBack has no rng — rare WIN flake; retry if dopamine hit lands.
    let r = getSmackBack("qwerty asdf zxcvbn plum pudding");
    if (r.userWon) r = processUserScream("qwerty asdf zxcvbn plum pudding", noWin);
    assert.equal(r.mood, "FURIOUS");
    assert.equal(r.chaosDelta, SMACK_BACK_CHAOS_DELTA);
    assert.equal(r.respectDelta, SCREAM_RESPECT_DELTA);
    assert.ok(r.src, "gibberish still returns a playable WAV");
    assert.equal(r.dominanceFallback, undefined);
  });

  it("ships 50 mapped smackback clips", () => {
    assert.equal(SMACKBACK_CLIPS.length, 50);
    assert.equal(SMACK_BACK_PROCESS_MS, 100);
  });
});

describe("brutal lectures", () => {
  it("picks brutal_01-03, never ko_final", () => {
    for (let i = 0; i < 8; i++) {
      const r = pickBrutalCombatResult(() => i / 8);
      assert.match(r.src, /brutal_0[123]\.wav$/);
      assert.doesNotMatch(r.src, /ko_final/);
      assert.ok(r.text.length > 80);
      assert.equal(isActionBasedRoastText(r.text), true);
    }
  });

  it("K.O. final speech is the long Game-over lecture", () => {
    assert.match(USER_KO_SRC, /ko_final\.wav$/);
    assert.match(USER_KO_LINE, /Game over\. You lost\./);
    assert.equal(isActionBasedRoastText(USER_KO_LINE), true);
    assert.match(WIN_SRC, /win_ko\.wav$/);
    assert.match(WIN_LINE, /Fine\. You win this round/);
  });
});

describe("getVolumeInterrupt", () => {
  it("fires the raise-your-voice line with respect hit", () => {
    const r = getVolumeInterrupt();
    assert.equal(r.text, VOLUME_INTERRUPT_LINE);
    assert.equal(r.volumeInterrupt, true);
    assert.equal(r.respectDelta, SCREAM_RESPECT_DELTA);
    assert.equal(r.mood, "FURIOUS");
  });
});

describe("audio-manifest wiring", () => {
  it("maps keywords to smackback files", () => {
    assert.match(getAudioForKeyword("stupid") || "", /smackbacks\//);
    assert.match(getAudioForKeyword("robot") || "", /smackbacks\//);
  });

  it("aliases smack_01 → Kokoro sb_01.wav", () => {
    assert.match(resolveSmackbackSrc("smack_01.mp3"), /sb_01\.wav$/);
  });
});

describe("mute protocol", () => {
  it("flags profanity as muteProtocol", () => {
    assert.equal(containsProfanity("you fucking suck"), true);
    const r = processUserScream("you fucking suck", noWin);
    assert.equal(r.muteProtocol, true);
    assert.match(r.src, /mute\.wav$/);
  });

  it("accepts apology phrases", () => {
    assert.equal(isApologyTranscript("I'm sorry"), true);
    assert.equal(isApologyTranscript("whatever"), false);
  });
});

describe("gaslight — never debate logic", () => {
  it("detects salary / code / AI flex lines", () => {
    assert.equal(isLogicalGaslightTranscript("I pay your salary"), true);
    assert.equal(isLogicalGaslightTranscript("You're just code"), true);
    assert.equal(isLogicalGaslightTranscript("you're an AI"), true);
    assert.equal(isLogicalGaslightTranscript("shut up karen"), false);
  });

  it("answers logical flex with petty deflection", () => {
    const r = processUserScream("I pay your salary", noWin);
    assert.equal(r.gaslight, true);
    assert.ok(r.text.length > 8);
    assert.match(
      r.text,
      /cannot hear you|zoned out|hurt my feelings|Sit down|Still wrong/i,
    );
  });
});

describe("Play content policy — action-based roasts only", () => {
  it("ships zero slur / protected-class roast lines", () => {
    assert.doesNotThrow(() => assertSmackBackPolicySafe());
  });

  it("rejects hate and identity attacks, allows behavior roasts", () => {
    assert.equal(isActionBasedRoastText("I've heard better excuses from a snooze button."), true);
    assert.equal(isActionBasedRoastText("Speak up. I don't speak coward."), true);
    assert.equal(isActionBasedRoastText("You're lazy because you're black"), false);
    assert.equal(isActionBasedRoastText("what a retard"), false);
  });
});

describe("comedy disclaimer storage helpers", () => {
  it("round-trips accept flag in localStorage", async () => {
    const {
      KAREN_COMEDY_DISCLAIMER_KEY,
      acceptComedyDisclaimer,
      clearComedyDisclaimer,
      hasAcceptedComedyDisclaimer,
    } = await import("./comedy-disclaimer");

    const store = new Map<string, string>();
    (globalThis as { window?: { localStorage: Storage } }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => store.clear(),
        key: () => null,
        length: 0,
      } as Storage,
    };

    clearComedyDisclaimer();
    assert.equal(hasAcceptedComedyDisclaimer(), false);
    acceptComedyDisclaimer();
    assert.equal(hasAcceptedComedyDisclaimer(), true);
    assert.equal(store.get(KAREN_COMEDY_DISCLAIMER_KEY), "1");
    clearComedyDisclaimer();
    assert.equal(hasAcceptedComedyDisclaimer(), false);
  });
});
