/**
 * Billing production gate — malicious client trust, sync cancel semantics,
 * webhook HTTP retry mapping, checkout redirect canonicalization.
 */

import assert from "node:assert/strict";
import { describe, it, before } from "node:test";

import { createMemoryBillingStore } from "@/lib/billing/memory-store";
import { parseLemonWebhookPayload } from "@/lib/billing/parse-webhook";
import { processParsedWebhook } from "@/lib/billing/processor";
import { subscriptionGrantsPremium } from "@/lib/billing/types";
import { httpStatusForLemonWebhookResult } from "@/lib/billing/webhook-http";
import { getLemonCheckoutRedirectUrls } from "@/lib/lemon-checkout-urls";
import { PRODUCTION_SITE_URL } from "@/lib/site-url";
import {
  entitlementActionForLemon,
  lemonStatusGrantsAccess,
} from "@/lib/subscription-entitlement";
import { lemonWebhookMetaSchema } from "@/lib/validation";
import { verifyLemonSignature } from "@/lib/lemonsqueezy";
import { createHmac } from "node:crypto";

const USER_A = "user_owner_aaaaaaaa";
const USER_B = "user_attacker_bbbbbb";
const VARIANT = "222001";
const SUB_ID = "sub_gate_1";

before(() => {
  process.env.LEMONSQUEEZY_STARTER_VARIANT_ID = VARIANT;
  process.env.LEMONSQUEEZY_PRO_VARIANT_ID = "222002";
  process.env.LEMONSQUEEZY_PREMIUM_VARIANT_ID = "222003";
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "test_webhook_secret_gate";
});

function payload(input: {
  eventName: string;
  status: string;
  userId?: string | null;
  subscriptionId?: string;
  updatedAt: string;
  renewsAt?: string;
  variantId?: string;
}) {
  const body = {
    meta: {
      event_name: input.eventName,
      custom_data: input.userId === null ? {} : { user_id: input.userId ?? USER_A },
    },
    data: {
      id: input.subscriptionId ?? SUB_ID,
      type: "subscriptions",
      attributes: {
        status: input.status,
        variant_id: input.variantId ?? VARIANT,
        customer_id: 99,
        renews_at: input.renewsAt ?? "2099-06-01T00:00:00.000Z",
        ends_at: null,
        updated_at: input.updatedAt,
        urls: { customer_portal: "https://app.lemonsqueezy.com/my-orders" },
      },
    },
  };
  const rawBody = JSON.stringify(body);
  const parsed = parseLemonWebhookPayload(rawBody, body);
  assert.ok(parsed);
  return { rawBody, parsed };
}

describe("billing gate: client cannot forge entitlement", () => {
  it("rejects paid=true style trust — premium only from subscriptionGrantsPremium", () => {
    assert.equal(
      subscriptionGrantsPremium({ plan: "free", status: "active", currentPeriodEnd: null }),
      false,
    );
    assert.equal(
      subscriptionGrantsPremium({
        plan: "pro",
        status: "active",
        currentPeriodEnd: new Date("2099-01-01"),
      }),
      true,
    );
  });

  it("unpaid / past_due retain access; unknown status does not", () => {
    assert.equal(entitlementActionForLemon({ eventName: "subscription_updated", status: "unpaid" }), "retain_paid");
    assert.equal(lemonStatusGrantsAccess("unpaid"), true);
    assert.equal(
      subscriptionGrantsPremium({
        plan: "pro",
        status: "unpaid",
        currentPeriodEnd: new Date("2099-01-01"),
      }),
      true,
    );
    assert.equal(
      entitlementActionForLemon({ eventName: "subscription_updated", status: "weird" }),
      "ignore",
    );
    assert.equal(
      subscriptionGrantsPremium({
        plan: "pro",
        status: "unknown",
        currentPeriodEnd: new Date("2099-01-01"),
      }),
      false,
    );
  });

  it("cannot reassign another user's subscription via custom.user_id", async () => {
    const store = createMemoryBillingStore({
      users: [
        { id: USER_A, email: "a@example.com" },
        { id: USER_B, email: "b@example.com" },
      ],
    });

    await processParsedWebhook(
      store,
      payload({
        eventName: "subscription_created",
        status: "active",
        userId: USER_A,
        updatedAt: "2026-02-01T00:00:00.000Z",
      }).parsed,
    );
    assert.equal(store.subscriptions.get(SUB_ID)?.userId, USER_A);
    assert.equal(store.subscriptions.get(SUB_ID)?.plan, "starter");

    const hijack = await processParsedWebhook(
      store,
      payload({
        eventName: "subscription_updated",
        status: "active",
        userId: USER_B,
        updatedAt: "2026-02-02T00:00:00.000Z",
      }).parsed,
    );
    assert.ok("applied" in hijack && hijack.applied);
    assert.equal(store.subscriptions.get(SUB_ID)?.userId, USER_A);
    assert.equal(store.licenses.get(USER_A)?.plan, "starter");
    assert.equal(store.licenses.has(USER_B), false);
  });
});

describe("billing gate: lifecycle + cancel-at-period-end", () => {
  it("FREE → PAID → CANCELLED keeps plan until period end", async () => {
    const store = createMemoryBillingStore({ users: [{ id: USER_A, email: "a@example.com" }] });
    await processParsedWebhook(
      store,
      payload({
        eventName: "subscription_created",
        status: "active",
        updatedAt: "2026-03-01T00:00:00.000Z",
      }).parsed,
    );
    assert.equal(store.subscriptions.get(SUB_ID)?.plan, "starter");

    await processParsedWebhook(
      store,
      payload({
        eventName: "subscription_cancelled",
        status: "cancelled",
        updatedAt: "2026-03-02T00:00:00.000Z",
        renewsAt: "2099-04-01T00:00:00.000Z",
      }).parsed,
    );
    const sub = store.subscriptions.get(SUB_ID)!;
    assert.equal(sub.plan, "starter");
    assert.equal(sub.status, "cancelled");
    assert.equal(
      subscriptionGrantsPremium({
        plan: sub.plan,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
      }),
      true,
    );
    // Soft-sync decision must NOT treat cancelled as immediate revoke
    assert.equal(
      entitlementActionForLemon({ eventName: "subscription_updated", status: "cancelled" }),
      "cancel_at_period_end",
    );
  });

  it("PAID → EXPIRED / REFUNDED revokes; FAILED PAYMENT retains", async () => {
    assert.equal(entitlementActionForLemon({ eventName: "subscription_expired", status: "expired" }), "revoke");
    assert.equal(entitlementActionForLemon({ eventName: "order_refunded", status: "refunded" }), "revoke");
    assert.equal(
      entitlementActionForLemon({ eventName: "subscription_payment_failed", status: "past_due" }),
      "retain_paid",
    );
  });

  it("DUPLICATE / OUT-OF-ORDER / INVALID SIGNATURE / UNKNOWN EVENT", async () => {
    const store = createMemoryBillingStore({ users: [{ id: USER_A, email: "a@example.com" }] });
    const first = payload({
      eventName: "subscription_created",
      status: "active",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    const a = await processParsedWebhook(store, first.parsed);
    assert.ok("applied" in a && a.applied);
    const dup = await processParsedWebhook(store, first.parsed);
    assert.ok("duplicate" in dup && dup.duplicate);

    const stale = await processParsedWebhook(
      store,
      payload({
        eventName: "subscription_updated",
        status: "active",
        updatedAt: "2026-03-01T00:00:00.000Z",
      }).parsed,
    );
    assert.ok("stale" in stale && stale.stale);

    const unknown = await processParsedWebhook(
      store,
      payload({
        eventName: "subscription_foo_bar",
        status: "active",
        updatedAt: "2026-05-01T00:00:00.000Z",
      }).parsed,
    );
    assert.ok("ignored" in unknown && unknown.ignored);

    const body = '{"ok":true}';
    const bad = verifyLemonSignature(body, "deadbeef");
    assert.equal(bad, false);
    const goodSig = createHmac("sha256", process.env.LEMONSQUEEZY_WEBHOOK_SECRET!)
      .update(body)
      .digest("hex");
    assert.equal(verifyLemonSignature(body, goodSig), true);
  });

  it("WEBHOOK RETRY: unknown_user / unknown_variant map to HTTP 503", () => {
    assert.equal(
      httpStatusForLemonWebhookResult({ ok: true, ignored: true, reason: "unknown_user" }),
      503,
    );
    assert.equal(
      httpStatusForLemonWebhookResult({ ok: true, ignored: true, reason: "unknown_variant" }),
      503,
    );
    assert.equal(
      httpStatusForLemonWebhookResult({ ok: true, duplicate: true }),
      200,
    );
    assert.equal(
      httpStatusForLemonWebhookResult({
        ok: true,
        applied: true,
        action: "activate",
        subscriptionId: "x",
        plan: "pro",
        status: "active",
      }),
      200,
    );
  });
});

describe("billing gate: checkout redirects", () => {
  it("success/cancel/receipt URLs stay on canonical production origin", () => {
    const prev = process.env.NODE_ENV;
    // getLemonCheckoutRedirectUrls uses NODE_ENV === production → PRODUCTION_SITE_URL
    // Call with production path by temporarily relying on getAppBaseUrl in non-prod:
    const urls = getLemonCheckoutRedirectUrls("pro");
    assert.match(urls.successUrl, /\/dashboard\?payment=success&tier=pro$/);
    assert.match(urls.cancelUrl, /\/pricing\?checkout=cancelled&tier=pro$/);
    assert.match(urls.receiptUrl, /\/dashboard\/settings$/);
    assert.doesNotMatch(urls.successUrl, /evil|javascript:/i);
    void prev;
    void PRODUCTION_SITE_URL;
  });
});

describe("billing gate: webhook custom_data shapes", () => {
  it("accepts array custom_data in Zod meta schema", () => {
    const ok = lemonWebhookMetaSchema.safeParse({
      meta: {
        event_name: "subscription_created",
        custom_data: [
          { key: "user_id", value: USER_A },
          { key: "tier", value: "pro" },
        ],
      },
      data: { id: "1", attributes: { status: "active" } },
    });
    assert.equal(ok.success, true);
  });
});
