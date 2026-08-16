/**
 * Authentication security gate — ownership, cookies, redirects, client userId rejection.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAuthCookies } from "@/lib/auth-cookies";
import {
  assertResourceOwner,
  nextAuthSecureCookies,
  nextAuthSessionCookieName,
  rejectClientUserId,
} from "@/lib/authz";
import {
  buildAppRedirectUrl,
  buildLoginRedirectUrl,
  getTrustedOriginForRedirects,
} from "@/lib/canonical-request-url";
import { isSafeRelativePath, safeAppPath } from "@/lib/safe-redirect";
import { PRODUCTION_SITE_URL, resolvePostAuthCallbackUrl } from "@/lib/site-url";

describe("authz: account ownership", () => {
  it("User A cannot own User B resources", () => {
    assert.equal(assertResourceOwner("user_aaaa_aaaa", "user_bbbb_bbbb"), false);
    assert.equal(assertResourceOwner("user_aaaa_aaaa", "user_aaaa_aaaa"), true);
  });

  it("rejects empty / short / null identities", () => {
    assert.equal(assertResourceOwner(null, "user_aaaa_aaaa"), false);
    assert.equal(assertResourceOwner("user_aaaa_aaaa", null), false);
    assert.equal(assertResourceOwner("", "user_aaaa_aaaa"), false);
    assert.equal(assertResourceOwner("short", "short"), false);
  });

  it("rejects client-submitted userId fields (IDOR bait)", () => {
    assert.equal(rejectClientUserId({ userId: "victim" }), true);
    assert.equal(rejectClientUserId({ user_id: "victim" }), true);
    assert.equal(rejectClientUserId({ ownerId: "victim" }), true);
    assert.equal(rejectClientUserId({ accountId: "victim" }), true);
    assert.equal(rejectClientUserId({ licenseKey: "lk_only" }), false);
    assert.equal(rejectClientUserId({ memoryId: "mem_1" }), false);
  });
});

describe("auth: secure cookies", () => {
  it("uses __Secure / __Host names and Secure+HttpOnly+SameSite=Lax in production", () => {
    const cookies = buildAuthCookies(true);
    assert.equal(cookies.sessionToken?.name, "__Secure-next-auth.session-token");
    assert.equal(cookies.sessionToken?.options?.httpOnly, true);
    assert.equal(cookies.sessionToken?.options?.secure, true);
    assert.equal(cookies.sessionToken?.options?.sameSite, "lax");
    assert.equal(cookies.csrfToken?.name, "__Host-next-auth.csrf-token");
    assert.equal(cookies.csrfToken?.options?.secure, true);
    assert.equal(cookies.pkceCodeVerifier?.options?.httpOnly, true);
    assert.equal(cookies.state?.options?.secure, true);
    assert.equal(nextAuthSessionCookieName(true), "__Secure-next-auth.session-token");
    assert.equal(nextAuthSecureCookies(true), true);
  });

  it("uses non-secure names in development", () => {
    const cookies = buildAuthCookies(false);
    assert.equal(cookies.sessionToken?.name, "next-auth.session-token");
    assert.equal(cookies.sessionToken?.options?.secure, false);
    assert.equal(nextAuthSecureCookies(false), false);
  });
});

describe("auth: open redirect + Host independence", () => {
  it("login redirect never uses attacker Host", () => {
    const prodEnv = { NODE_ENV: "production" };
    assert.equal(getTrustedOriginForRedirects(prodEnv), PRODUCTION_SITE_URL);
    const login = buildLoginRedirectUrl("/dashboard", prodEnv);
    assert.equal(login.origin, PRODUCTION_SITE_URL);
    assert.equal(login.pathname, "/login");
    assert.equal(login.searchParams.get("callbackUrl"), "/dashboard");
    const evil = buildLoginRedirectUrl("//evil.tld", prodEnv);
    assert.equal(evil.searchParams.get("callbackUrl"), null);
    const consent = buildAppRedirectUrl("/consent", prodEnv);
    assert.equal(consent.href, `${PRODUCTION_SITE_URL}/consent`);
  });

  it("post-auth callback never leaves canonical origin", () => {
    assert.doesNotMatch(resolvePostAuthCallbackUrl("https://evil.example/x"), /evil\.example/);
    assert.equal(isSafeRelativePath("/dashboard/settings"), true);
    assert.equal(safeAppPath("https://evil.tld", "/dashboard"), "/dashboard");
  });
});

describe("auth: IDOR surface expectations", () => {
  it("documents session-scoped resources that must compare session userId", () => {
    const sessionScoped = [
      "memories",
      "messages",
      "subscription",
      "billing status",
      "dashboard data",
      "widget configuration",
      "license data",
      "settings",
      "analytics",
    ] as const;
    for (const resource of sessionScoped) {
      // Ownership helper is the gate used by route handlers / queries.
      assert.equal(
        assertResourceOwner("owner_session_aaaaaaaa", "owner_session_aaaaaaaa"),
        true,
        resource,
      );
      assert.equal(
        assertResourceOwner("owner_session_aaaaaaaa", "other_user_bbbbbbbb"),
        false,
        resource,
      );
    }
  });
});
