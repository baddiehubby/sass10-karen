import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AMBUSH_FAITH_SHATTER_LINE,
  AMBUSH_MIN_WORDS,
  AMBUSH_TRAPS,
  analyzeAmbushAnswer,
  ambushShatterResult,
  pickAmbushTrap,
} from "./ambush";

describe("ambush traps", () => {
  it("ships invasive open-ended prompts", () => {
    assert.ok(AMBUSH_TRAPS.length >= 4);
    const prompts = AMBUSH_TRAPS.map((t) => t.prompt).join(" ");
    assert.match(prompts, /failing/i);
    assert.match(prompts, /afraid/i);
    assert.match(prompts, /excuse/i);
  });

  it("flags short and excuse answers for Faith Shatter", () => {
    const weak = analyzeAmbushAnswer("I don't know");
    assert.equal(weak.short, true);
    assert.equal(weak.hasExcuse, true);
    assert.equal(weak.faithShatter, true);
    assert.equal(ambushShatterResult(weak).text, AMBUSH_FAITH_SHATTER_LINE);

    const trying = analyzeAmbushAnswer("I'm trying");
    assert.equal(trying.faithShatter, true);

    const long = "I keep failing because I freeze when it matters and then pretend planning counts as progress so I never have to face the risk of looking stupid.";
    const strong = analyzeAmbushAnswer(long);
    assert.ok(strong.wordCount >= AMBUSH_MIN_WORDS);
    assert.equal(strong.faithShatter, false);
  });

  it("picks a trap", () => {
    const t = pickAmbushTrap(() => 0);
    assert.ok(t.id);
    assert.ok(t.prompt.length > 10);
  });
});
