import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { collectProductionEnvIssues, assertProductionEnv } from "@/lib/env";

describe("production env validation", () => {
  it("flags missing mandatory production keys", () => {
    const issues = collectProductionEnvIssues({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    const keys = issues.map((i) => i.key);
    assert.ok(keys.some((k) => k.includes("DATABASE_URL")));
    assert.ok(keys.some((k) => k.includes("NEXTAUTH_SECRET")));
    assert.ok(keys.some((k) => k.includes("LEMONSQUEEZY_WEBHOOK_SECRET")));
    assert.ok(keys.some((k) => k.includes("VARIANT")));
    assert.ok(keys.some((k) => k.includes("EIDATA_HASH_SALT")));
  });

  it("rejects placeholder and sqlite production database urls", () => {
    const issues = collectProductionEnvIssues({
      NODE_ENV: "production",
      DATABASE_URL: "file:./dev.db",
      NEXTAUTH_SECRET: "long-enough-secret-value",
      LEMONSQUEEZY_API_KEY: "key",
      LEMONSQUEEZY_WEBHOOK_SECRET: "whsec",
      LEMONSQUEEZY_STARTER_VARIANT_ID: "1",
      LEMONSQUEEZY_PRO_VARIANT_ID: "2",
      LEMONSQUEEZY_PREMIUM_VARIANT_ID: "3",
      EIDATA_HASH_SALT: "salt",
    });
    assert.ok(issues.some((i) => i.key === "DATABASE_URL"));
  });

  it("accepts a complete production-shaped config", () => {
    const issues = collectProductionEnvIssues({
      NODE_ENV: "production",
      // No user:pass@ form — release secret-scan treats that as a credential leak.
      DATABASE_URL: "postgresql://db.example.com:5432/buddie",
      NEXTAUTH_SECRET: "long-enough-secret-value",
      NEXTAUTH_URL: "https://www.buddieai.com",
      NEXT_PUBLIC_SITE_URL: "https://www.buddieai.com",
      NEXT_PUBLIC_APP_URL: "https://www.buddieai.com",
      LEMONSQUEEZY_API_KEY: "key",
      LEMONSQUEEZY_WEBHOOK_SECRET: "whsec",
      LEMONSQUEEZY_STARTER_VARIANT_ID: "1",
      LEMONSQUEEZY_PRO_VARIANT_ID: "2",
      LEMONSQUEEZY_PREMIUM_VARIANT_ID: "3",
      EIDATA_HASH_SALT: "salt",
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
    });
    assert.equal(issues.length, 0);
  });

  it("does not throw assertProductionEnv outside production runtime", () => {
    assert.doesNotThrow(() =>
      assertProductionEnv({
        NODE_ENV: "development",
      }),
    );
  });
});
