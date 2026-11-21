import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  KAREN_RAGE_QUIET_THRESHOLD,
  KAREN_RAGE_SCREAM_THRESHOLD,
  KAREN_RAGE_START,
  PersonalityEngine,
  moodModeFromRage,
  normalizeCombatLine,
  rollRageDelta,
} from "./game-engine";
import {
  processCombatWithMood,
  processUserScream,
} from "./smack-back";

describe("karenRageLevel mood randomizer", () => {
  it("rolls deltas in −10…+20", () => {
    assert.equal(rollRageDelta(() => 0), -10);
    assert.equal(rollRageDelta(() => 1), 20);
  });

  it("maps scream / quiet thresholds", () => {
    assert.equal(moodModeFromRage(KAREN_RAGE_SCREAM_THRESHOLD + 1), "scream");
    assert.equal(moodModeFromRage(KAREN_RAGE_QUIET_THRESHOLD - 1), "quiet");
    assert.equal(moodModeFromRage(KAREN_RAGE_START), "normal");
  });

  it("fluctuates on every interaction and detects repeats", () => {
    const engine = new PersonalityEngine();
    assert.equal(engine.getRageLevel(), KAREN_RAGE_START);

    const first = engine.registerCombatInteraction("I am the boss", () => 1);
    assert.equal(first.repeated, false);
    assert.equal(first.rage, KAREN_RAGE_START + 20);

    const second = engine.registerCombatInteraction("I am the boss", () => 0);
    assert.equal(second.repeated, true);
    assert.ok(second.rage > KAREN_RAGE_SCREAM_THRESHOLD);
  });

  it("normalizes combat lines for broken-record checks", () => {
    assert.equal(normalizeCombatLine("  I Am The Boss  "), "i am the boss");
  });
});

describe("processCombatWithMood", () => {
  it("ignores keywords when screaming", () => {
    const r = processCombatWithMood("stupid robot", {
      repeated: false,
      mode: "scream",
      rage: 95,
    });
    assert.equal(r.screamingRage, true);
    assert.equal(r.matchedKeywords, undefined);
  });

  it("goes quiet and menacing under threshold", () => {
    const r = processCombatWithMood("hello", {
      repeated: false,
      mode: "quiet",
      rage: 5,
    });
    assert.equal(r.quietRage, true);
    assert.match(r.text, /Fine\. I'm done talking\./i);
  });

  it("triggers Mute Protocol on exact repeats", () => {
    const r = processCombatWithMood("I am the boss", {
      repeated: true,
      mode: "scream",
      rage: 90,
    });
    assert.equal(r.brokenRecord, true);
    assert.equal(r.muteProtocol, true);
    assert.match(r.text, /broken record/i);
  });

  it("falls through to keyword smack-back when normal", () => {
    const noWin = () => 0.5;
    const baseline = processUserScream("You are a stupid robot", noWin);
    const r = processCombatWithMood(
      "You are a stupid robot",
      { repeated: false, mode: "normal", rage: 45 },
      noWin,
    );
    assert.equal(r.screamingRage, undefined);
    assert.equal(r.quietRage, undefined);
    assert.deepEqual(r.matchedKeywords, baseline.matchedKeywords);
  });
});
