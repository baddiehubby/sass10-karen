import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FREE_ROAST_QUESTION_COUNT,
  INTERROGATION_STAGE_COUNT,
  PersonalityEngine,
  QUESTIONS,
  ROAST_QUESTIONS,
  calculateResults,
  dominantTrait,
  emptyScores,
} from "./game-engine";
import { getRoast, getVerdict, progressiveMood, roastLadderLevel } from "./roasts";
import { CALLBACK_ROASTS, findCallbackRoast } from "./callbacks";
import { getSmackBack } from "./smack-back";

describe("QUESTIONS + calculateResults", () => {
  it("has 9 free questions with 3 options each (Q10 is cliffhanger)", () => {
    assert.equal(QUESTIONS.length, FREE_ROAST_QUESTION_COUNT);
    assert.equal(INTERROGATION_STAGE_COUNT, 10);
    for (const q of QUESTIONS) {
      assert.equal(q.options.length, 3);
      assert.ok(q.text.length > 5);
    }
  });

  it("calculateResults clamps traits to 0–100", () => {
    const scores = calculateResults([
      { questionId: "q1_gym", optionId: "a" },
      { questionId: "q2_couch", optionId: "a" },
      { questionId: "q3_deadline", optionId: "a" },
      { questionId: "q4_message", optionId: "c" },
      { questionId: "q5_morning", optionId: "b" },
      { questionId: "q6_social", optionId: "a" },
      { questionId: "q7_night", optionId: "b" },
      { questionId: "q8_busy", optionId: "a" },
      { questionId: "q9_excuse", optionId: "b" },
    ]);
    assert.ok(scores.overthinking >= 0 && scores.overthinking <= 100);
    assert.ok(scores.laziness >= 0 && scores.laziness <= 100);
    assert.ok(scores.chaos >= 0 && scores.chaos <= 100);
    assert.ok(scores.laziness > 40);
  });
});

describe("PersonalityEngine", () => {
  it("mirrors ROAST_QUESTIONS for the UI", () => {
    assert.equal(ROAST_QUESTIONS.length, FREE_ROAST_QUESTION_COUNT);
    assert.equal(ROAST_QUESTIONS[0]!.prompt, QUESTIONS[0]!.text);
  });

  it("tracks userHistory and completes after 9 answers", () => {
    const engine = new PersonalityEngine();
    for (const q of QUESTIONS) {
      engine.answer(q.id, "a");
    }
    assert.equal(engine.isComplete, true);
    assert.equal(engine.getUserHistory().length, FREE_ROAST_QUESTION_COUNT);
    assert.equal(engine.getUserHistory()[0]!.answerId, "a");
    assert.ok(engine.getScores().laziness > 0 || engine.getScores().overthinking > 0);
  });
});

describe("callback wit engine", () => {
  it("ships 10 callback roasts", () => {
    assert.equal(CALLBACK_ROASTS.length, 10);
  });

  it("catches couch-all-day vs too-busy contradiction", () => {
    const line = findCallbackRoast("q8_busy", "a", [
      {
        questionId: "q2_couch",
        optionId: 0,
        answerId: "a",
        label: "I sat on the couch all day",
      },
    ]);
    assert.ok(line);
    assert.match(line!, /couch all day/i);
    assert.match(line!, /too busy/i);
  });

  it("getRoast prefers callback when history matches", () => {
    const roast = getRoast(
      "q8_busy",
      "a",
      emptyScores(),
      [
        {
          questionId: "q2_couch",
          optionId: 0,
          answerId: "a",
          label: "I sat on the couch all day",
        },
      ],
    );
    assert.equal(roast.callback, true);
    assert.equal(roast.mood, "FURIOUS");
    assert.match(roast.text, /Pick a lie/i);
  });
});

describe("progressiveMood", () => {
  it("escalates sarcasm → angry → furious", () => {
    assert.equal(progressiveMood(0, "SARCASTIC"), "SARCASTIC");
    assert.equal(progressiveMood(3, "SARCASTIC"), "ANGRY");
    assert.equal(progressiveMood(7, "SARCASTIC"), "FURIOUS");
  });
});

describe("getVerdict", () => {
  it("returns delulu overthinking when score is high", () => {
    const v = getVerdict({ overthinking: 90, chaos: 10, laziness: 5 });
    assert.equal(v.trait, "overthinking");
    assert.equal(v.title, "MAIN CHARACTER DELULU");
    assert.match(v.roast, /hamster wheel/i);
  });

  it("returns negative aura laziness when score is high", () => {
    const v = getVerdict({ overthinking: 10, chaos: 10, laziness: 88 });
    assert.equal(v.title, "NEGATIVE AURA FARMER");
    assert.match(v.roast, /aura points are in the negative/i);
  });

  it("returns TikTok-trauma chaos when score is high", () => {
    const v = getVerdict({ overthinking: 10, chaos: 92, laziness: 10 });
    assert.equal(v.title, "WALKING ALGORITHM");
    assert.match(v.roast, /TikTok sounds and trauma/i);
  });
});

describe("roast ladder", () => {
  it("maps question index to L1 / L2 / L3", () => {
    assert.equal(roastLadderLevel(0), 1);
    assert.equal(roastLadderLevel(3), 2);
    assert.equal(roastLadderLevel(7), 3);
  });

  it("uses light line early and brutal line late", () => {
    const light = getRoast("q1_gym", "a", emptyScores());
    assert.equal(light.ladder, 1);
    assert.match(light.text, /one of those/i);

    const brutal = getRoast("q8_busy", "b", emptyScores());
    assert.equal(brutal.ladder, 3);
    assert.match(brutal.text, /touch grass|motivation already bounced/i);
  });
});

describe("getRoast", () => {
  it("returns a punchy mid-quiz line", () => {
    const roast = getRoast("q1_gym", "a", emptyScores());
    assert.ok(roast.text.length > 10);
    assert.equal(dominantTrait({ overthinking: 90, chaos: 1, laziness: 1 }), "overthinking");
  });
});

describe("getSmackBack wiring", () => {
  it("returns an immediate FURIOUS comeback with Respect penalty", () => {
    const r = getSmackBack("you're wrong karen");
    assert.equal(r.mood, "FURIOUS");
    assert.ok(r.text.length > 12);
    assert.equal(r.chaosDelta, 5);
    assert.equal(r.respectDelta, -5);
    assert.ok(r.audioId.startsWith("smackback:"));
  });
});
