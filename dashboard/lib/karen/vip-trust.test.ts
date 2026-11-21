import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FAITH_SHATTER_LOCK_KEY,
  hasVipTrustPremium,
  isVipTrustActive,
  isVipTrustGoalTranscript,
  shouldShowVipTrustBadge,
  VIP_TRUST_FREE_INTERACTIONS,
  VIP_TRUST_GOAL_LINE,
  VIP_TRUST_WELCOME_LINE,
  type VipTrustState,
} from "./vip-trust";

describe("vip trust onboarding", () => {
  it("ships welcome + goal copy", () => {
    assert.match(VIP_TRUST_WELCOME_LINE, /potential/i);
    assert.match(VIP_TRUST_GOAL_LINE, /watching/i);
    assert.equal(VIP_TRUST_FREE_INTERACTIONS, 3);
  });

  it("activates badge only during the soft window", () => {
    const mid: VipTrustState = { welcomeComplete: true, interactions: 1 };
    const done: VipTrustState = { welcomeComplete: true, interactions: 3 };
    assert.equal(isVipTrustActive(mid), true);
    assert.equal(shouldShowVipTrustBadge(mid), true);
    assert.equal(isVipTrustActive(done), false);
    assert.equal(shouldShowVipTrustBadge(done), false);
    assert.equal(hasVipTrustPremium(false, mid), true);
    assert.equal(hasVipTrustPremium(false, done), false);
    assert.equal(hasVipTrustPremium(true, done), true);
  });

  it("detects goal-like transcripts", () => {
    assert.equal(isVipTrustGoalTranscript("Go to the gym"), true);
    assert.equal(isVipTrustGoalTranscript("I want to quit smoking"), true);
    assert.equal(isVipTrustGoalTranscript("um"), false);
    assert.equal(isVipTrustGoalTranscript("lol"), false);
  });

  it("persists Faith Shatter lock under a dedicated key", () => {
    assert.equal(FAITH_SHATTER_LOCK_KEY, "karen.faithShatter.lock");
  });
});
