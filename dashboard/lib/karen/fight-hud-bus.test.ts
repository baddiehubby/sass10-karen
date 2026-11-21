import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchFightHit, dispatchFightHud, getFightHud, subscribeFightHit } from "./fight-hud-bus";

describe("fight HUD bus", () => {
  it("ignores zero-damage hits", () => {
    const hits: number[] = [];
    const unsub = subscribeFightHit((h) => hits.push(h.amount));
    assert.equal(dispatchFightHit({ amount: 0, target: "dignity", pose: "scream" }), null);
    assert.equal(hits.length, 0);
    unsub();
  });

  it("publishes dignity hits with scream pose by default", () => {
    let seen = 0;
    const unsub = subscribeFightHit((h) => {
      seen = h.amount;
      assert.equal(h.target, "dignity");
      assert.equal(h.pose, "scream");
    });
    const hit = dispatchFightHit({ amount: 25, target: "dignity", pose: "scream" });
    assert.equal(hit?.amount, 25);
    assert.equal(seen, 25);
    unsub();
  });

  it("stores meter snapshot", () => {
    dispatchFightHud({ visible: true, dignity: 77, patience: 100 });
    const snap = getFightHud();
    assert.equal(snap.visible, true);
    assert.equal(snap.dignity, 77);
    assert.equal(snap.patience, 100);
    dispatchFightHud({ visible: false, dignity: 100, patience: 100 });
  });
});
