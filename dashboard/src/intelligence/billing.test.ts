import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it, before } from "node:test";
import { createMemoryBillingStore } from "@/lib/billing/memory-store";
import { parseLemonWebhookPayload } from "@/lib/billing/parse-webhook";
import { processParsedWebhook } from "@/lib/billing/processor";
import { subscriptionGrantsPremium } from "@/lib/billing/types";
import { verifyLemonSignature } from "@/lib/lemonsqueezy";

const USER_ID = "user_billing_1";
const USER_EMAIL = "billing@example.com";
const VARIANT_STARTER = "111001";
const SUB_ID = "sub_1001";

before(() => {
  process.env.LEMONSQUEEZY_STARTER_VARIANT_ID = VARIANT_STARTER;
  process.env.LEMONSQUEEZY_PRO_VARIANT_ID = "111002";
  process.env.LEMONSQUEEZY_PREMIUM_VARIANT_ID = "111003";
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "test_webhook_secret_billing";
});

function lemonPayload(input: {
  eventName: string;
  subscriptionId?: string;
  status: string;
  variantId?: string;
  userId?: string | null;
  email?: string | null;
  updatedAt: string;
  renewsAt?: string;
  customerId?: string;
}): { rawBody: string; parsed: NonNullable<ReturnType<typeof parseLemonWebhookPayload>> } {
  const body = {
    meta: {
      event_name: input.eventName,
      custom_data: input.userId
        ? { user_id: input.userId }
        : input.userId === null
          ? {}
          : { user_id: USER_ID },
    },
    data: {
      id: input.subscriptionId ?? SUB_ID,
      attributes: {
        status: input.status,
        variant_id: input.variantId ?? VARIANT_STARTER,
        user_email: input.email === null ? undefined : (input.email ?? USER_EMAIL),
        customer_id: input.customerId ?? "cust_9",
        renews_at: input.renewsAt ?? "2099-01-15T00:00:00.000Z",
        updated_at: input.updatedAt,
        urls: { customer_portal: "https://example.com/portal" },
      },
    },
  };
  const rawBody = JSON.stringify(body);
  const parsed = parseLemonWebhookPayload(rawBody, body);
  assert.ok(parsed);
  return { rawBody, parsed };
}

describe("Lemon production billing", () => {
  it("grants premium on new subscription", async () => {
    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });
    const { parsed } = lemonPayload({
      eventName: "subscription_created",
      status: "active",
      updatedAt: "2026-01-10T12:00:00.000Z",
    });

    const result = await processParsedWebhook(store, parsed);
    assert.equal(result.ok, true);
    assert.ok("applied" in result && result.applied);
    if ("applied" in result) {
      assert.equal(result.plan, "starter");
      assert.equal(result.status, "active");
    }

    const sub = store.subscriptions.get(SUB_ID);
    assert.ok(sub);
    assert.equal(sub.plan, "starter");
    assert.equal(subscriptionGrantsPremium(sub), true);
    assert.equal(store.licenses.get(USER_ID)?.plan, "starter");
  });

  it("extends period on renewal", async () => {
    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });
    const first = lemonPayload({
      eventName: "subscription_created",
      status: "active",
      updatedAt: "2026-01-10T12:00:00.000Z",
      renewsAt: "2099-02-10T00:00:00.000Z",
    });
    await processParsedWebhook(store, first.parsed);

    const renewal = lemonPayload({
      eventName: "subscription_payment_success",
      status: "active",
      updatedAt: "2026-02-10T12:00:00.000Z",
      renewsAt: "2099-03-10T00:00:00.000Z",
    });
    const result = await processParsedWebhook(store, renewal.parsed);
    assert.ok("applied" in result && result.applied);

    const sub = store.subscriptions.get(SUB_ID)!;
    assert.equal(sub.currentPeriodEnd?.toISOString(), "2099-03-10T00:00:00.000Z");
    assert.equal(subscriptionGrantsPremium(sub), true);
  });

  it("revokes entitlement on cancellation", async () => {
    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });
    await processParsedWebhook(
      store,
      lemonPayload({
        eventName: "subscription_created",
        status: "active",
        updatedAt: "2026-01-10T12:00:00.000Z",
      }).parsed,
    );

    const cancel = await processParsedWebhook(
      store,
      lemonPayload({
        eventName: "subscription_cancelled",
        status: "cancelled",
        updatedAt: "2026-01-20T12:00:00.000Z",
      }).parsed,
    );
    assert.ok("applied" in cancel && cancel.applied);
    if ("applied" in cancel) assert.equal(cancel.action, "revoke");

    const sub = store.subscriptions.get(SUB_ID)!;
    assert.equal(sub.plan, "free");
    assert.ok(sub.cancelledAt);
    assert.equal(subscriptionGrantsPremium(sub), false);
    assert.equal(store.licenses.get(USER_ID)?.plan, "free");
  });

  it("denies premium when subscription period has expired", () => {
    assert.equal(
      subscriptionGrantsPremium({
        plan: "starter",
        status: "active",
        currentPeriodEnd: new Date("2020-01-01T00:00:00.000Z"),
        now: new Date("2026-01-01T00:00:00.000Z"),
      }),
      false,
    );
  });

  it("is idempotent for duplicate webhooks", async () => {
    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });
    const event = lemonPayload({
      eventName: "subscription_created",
      status: "active",
      updatedAt: "2026-01-10T12:00:00.000Z",
    });

    const first = await processParsedWebhook(store, event.parsed);
    const second = await processParsedWebhook(store, event.parsed);
    assert.ok("applied" in first && first.applied);
    assert.ok("duplicate" in second && second.duplicate);
    assert.equal(store.subscriptions.size, 1);
  });

  it("rejects invalid webhook signatures", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    const good = createHmac("sha256", "test_webhook_secret_billing").update(body, "utf8").digest("hex");
    assert.equal(verifyLemonSignature(body, good), true);
    assert.equal(verifyLemonSignature(body, "deadbeef"), false);
    assert.equal(verifyLemonSignature(body, null), false);
  });

  it("ignores webhooks for unknown users", async () => {
    const store = createMemoryBillingStore({ users: [] });
    const result = await processParsedWebhook(
      store,
      lemonPayload({
        eventName: "subscription_created",
        status: "active",
        updatedAt: "2026-01-10T12:00:00.000Z",
        userId: null,
        email: "nobody@example.com",
      }).parsed,
    );
    assert.ok("ignored" in result && result.ignored);
    if ("ignored" in result) assert.equal(result.reason, "unknown_user");
    assert.equal(store.subscriptions.size, 0);
  });

  it("ignores unknown / unmapped variants", async () => {
    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });
    const result = await processParsedWebhook(
      store,
      lemonPayload({
        eventName: "subscription_created",
        status: "active",
        updatedAt: "2026-01-10T12:00:00.000Z",
        variantId: "999999",
      }).parsed,
    );
    assert.ok("ignored" in result && result.ignored);
    if ("ignored" in result) assert.equal(result.reason, "unknown_variant");
    assert.equal(store.subscriptions.size, 0);
  });

  it("ignores out-of-order older provider updates", async () => {
    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });
    await processParsedWebhook(
      store,
      lemonPayload({
        eventName: "subscription_updated",
        status: "active",
        updatedAt: "2026-01-20T12:00:00.000Z",
        renewsAt: "2099-03-01T00:00:00.000Z",
      }).parsed,
    );

    const stale = await processParsedWebhook(
      store,
      lemonPayload({
        eventName: "subscription_updated",
        status: "past_due",
        updatedAt: "2026-01-15T12:00:00.000Z",
        renewsAt: "2099-02-01T00:00:00.000Z",
      }).parsed,
    );
    assert.ok("stale" in stale && stale.stale);

    const sub = store.subscriptions.get(SUB_ID)!;
    assert.equal(sub.status, "active");
    assert.equal(sub.currentPeriodEnd?.toISOString(), "2099-03-01T00:00:00.000Z");
  });

  it("revokes on refund", async () => {
    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });
    await processParsedWebhook(
      store,
      lemonPayload({
        eventName: "subscription_created",
        status: "active",
        updatedAt: "2026-01-10T12:00:00.000Z",
      }).parsed,
    );

    const refund = await processParsedWebhook(
      store,
      lemonPayload({
        eventName: "subscription_payment_refunded",
        status: "refunded",
        updatedAt: "2026-01-25T12:00:00.000Z",
      }).parsed,
    );
    assert.ok("applied" in refund && refund.applied);
    if ("applied" in refund) assert.equal(refund.action, "revoke");

    const sub = store.subscriptions.get(SUB_ID)!;
    assert.equal(sub.plan, "free");
    assert.equal(subscriptionGrantsPremium(sub), false);
  });
});
