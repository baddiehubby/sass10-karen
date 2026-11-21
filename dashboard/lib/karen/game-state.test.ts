import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyDignityDamage,
  applyPatienceDamage,
  createFightState,
  fightOutcome,
  KAREN_COUNTER_DAMAGE_MAX,
  KAREN_COUNTER_DAMAGE_MIN,
  KAREN_PATIENCE_START,
  rollHesitationDamage,
  rollKarenCounterDamage,
  rollUserScreamHit,
  USER_DIGNITY_START,
  USER_HIT_DAMAGE_MAX,
  USER_HIT_DAMAGE_MIN,
  USER_SCREAM_HIT_CHANCE,
} from "./game-state";

describe("KO fight state", () => {
  it("starts both fighters at 100", () => {
    const f = createFightState();
    assert.equal(f.karenPatience, KAREN_PATIENCE_START);
    assert.equal(f.userDignity, USER_DIGNITY_START);
    assert.equal(fightOutcome(f), "fighting");
  });

  it("hesitation deals 0 patience damage", () => {
    assert.equal(rollHesitationDamage(), 0);
    const { fighters, outcome } = applyPatienceDamage(createFightState(), 0);
    assert.equal(fighters.karenPatience, 100);
    assert.equal(outcome, "fighting");
  });

  it("scream miss deals 0; hit rolls 10–15", () => {
    const miss = rollUserScreamHit(() => 0.99);
    assert.equal(miss.hit, false);
    assert.equal(miss.damage, 0);

    const hit = rollUserScreamHit(() => 0);
    assert.equal(hit.hit, true);
    assert.ok(hit.damage >= USER_HIT_DAMAGE_MIN);
    assert.ok(hit.damage <= USER_HIT_DAMAGE_MAX);
  });

  it("Karen counters roll 20–25 — heavier than a user hit", () => {
    const dmg = rollKarenCounterDamage(() => 0);
    assert.equal(dmg, KAREN_COUNTER_DAMAGE_MIN);
    assert.ok(KAREN_COUNTER_DAMAGE_MIN > USER_HIT_DAMAGE_MAX);
    assert.equal(rollKarenCounterDamage(() => 0.999), KAREN_COUNTER_DAMAGE_MAX);
  });

  it("user K.O. when Dignity hits 0", () => {
    const { fighters, outcome } = applyDignityDamage(createFightState(), 100);
    assert.equal(fighters.userDignity, 0);
    assert.equal(outcome, "user_ko");
  });

  it("rare Karen K.O. when Patience hits 0", () => {
    const { fighters, outcome } = applyPatienceDamage(createFightState(), 100);
    assert.equal(fighters.karenPatience, 0);
    assert.equal(outcome, "karen_ko");
  });

  it("is rigged: five average counters empty Dignity before Patience can fall", () => {
    assert.ok(USER_SCREAM_HIT_CHANCE < 0.5);
    let dignity = USER_DIGNITY_START;
    let hits = 0;
    while (dignity > 0) {
      dignity = Math.max(0, dignity - KAREN_COUNTER_DAMAGE_MIN);
      hits += 1;
    }
    assert.ok(hits <= 5);
    const hitsToDrainPatience = Math.ceil(
      KAREN_PATIENCE_START / USER_HIT_DAMAGE_MAX,
    );
    assert.ok(hitsToDrainPatience > hits);
  });
});
