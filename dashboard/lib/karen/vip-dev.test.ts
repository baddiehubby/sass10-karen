import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { isDevVipMode, resolveKarenPremium } from "./vip";

const KEYS = [
  "NEXT_PUBLIC_DEV_VIP_MODE",
  "DEV_VIP_MODE",
  "NEXT_PUBLIC_KAREN_REAL_PAYWALL",
  "NODE_ENV",
] as const;

describe("DEV VIP bypass", () => {
  const snapshot: Record<string, string | undefined> = {};
  // NODE_ENV is typed read-only by Next's types; tests must still be able to flip it.
  const env = process.env as Record<string, string | undefined>;

  afterEach(() => {
    for (const k of KEYS) {
      if (k in snapshot) {
        const v = snapshot[k];
        if (v === undefined) delete env[k];
        else env[k] = v;
        delete snapshot[k];
      }
    }
  });

  function setEnv(key: (typeof KEYS)[number], value: string | undefined) {
    if (!(key in snapshot)) snapshot[key] = env[key];
    if (value === undefined) delete env[key];
    else env[key] = value;
  }

  it("hard-bypasses premium in development", () => {
    setEnv("NODE_ENV", "development");
    setEnv("NEXT_PUBLIC_DEV_VIP_MODE", undefined);
    setEnv("DEV_VIP_MODE", undefined);
    assert.equal(isDevVipMode(), true);
    assert.equal(resolveKarenPremium(false), true);
    assert.equal(resolveKarenPremium(true), true);
  });

  it("QA opt-out: NEXT_PUBLIC_KAREN_REAL_PAYWALL=true restores the real paywall in dev", () => {
    setEnv("NODE_ENV", "development");
    setEnv("NEXT_PUBLIC_DEV_VIP_MODE", "true");
    setEnv("DEV_VIP_MODE", "true");
    setEnv("NEXT_PUBLIC_KAREN_REAL_PAYWALL", "true");
    assert.equal(isDevVipMode(), false);
    // Free user is gated; a paid user (webhook set isPremium) is unlocked.
    assert.equal(resolveKarenPremium(false), false);
    assert.equal(resolveKarenPremium(null), false);
    assert.equal(resolveKarenPremium(true), true);
  });

  it("paywall flag only counts when exactly 'true'", () => {
    setEnv("NODE_ENV", "development");
    setEnv("NEXT_PUBLIC_KAREN_REAL_PAYWALL", "1");
    assert.equal(isDevVipMode(), true);
  });

  it("production without any flags gates on Prisma isPremium only", () => {
    setEnv("NODE_ENV", "production");
    setEnv("NEXT_PUBLIC_DEV_VIP_MODE", undefined);
    setEnv("DEV_VIP_MODE", undefined);
    setEnv("NEXT_PUBLIC_KAREN_REAL_PAYWALL", undefined);
    assert.equal(resolveKarenPremium(undefined), false);
    assert.equal(resolveKarenPremium(false), false);
    assert.equal(resolveKarenPremium(true), true);
  });

  it("never bypasses in production", () => {
    setEnv("NODE_ENV", "production");
    setEnv("NEXT_PUBLIC_DEV_VIP_MODE", "true");
    setEnv("DEV_VIP_MODE", "true");
    assert.equal(isDevVipMode(), false);
    assert.equal(resolveKarenPremium(false), false);
    assert.equal(resolveKarenPremium(true), true);
  });
});
