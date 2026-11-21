import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildChallengeUrl,
  challengeTaunt,
  normalizeChallengeTrait,
  parseChallengeInvite,
  retentionPrompt,
  traitDisplayName,
} from "./share-loop";

describe("share-loop viral helpers", () => {
  it("builds challenge URLs with score + trait", () => {
    assert.equal(
      buildChallengeUrl(94, "overthinking"),
      "https://karensass10.com/karen?challenge=94&trait=overthinking",
    );
    assert.equal(
      buildChallengeUrl(88, "chaos"),
      "https://karensass10.com/karen?challenge=88&trait=chaos",
    );
  });

  it("parses challenge invites", () => {
    const invite = parseChallengeInvite("?challenge=94&trait=overthinking");
    assert.deepEqual(invite, { score: 94, trait: "overthinking" });
    assert.equal(parseChallengeInvite(""), null);
  });

  it("taunts with the friend score + trait", () => {
    assert.equal(
      challengeTaunt(94, "overthinking"),
      "Your friend scored a 94 in Overthinking. Can you beat that? Probably not.",
    );
  });

  it("locks same-day free replays with the Karen line", () => {
    assert.equal(
      retentionPrompt(),
      "I already know everything about you. Come back tomorrow.",
    );
  });

  it("normalizes trait aliases", () => {
    assert.equal(normalizeChallengeTrait("lazy"), "laziness");
    assert.equal(traitDisplayName("laziness"), "Laziness");
  });
});
