import assert from "node:assert/strict";

import { createHmac } from "node:crypto";

import { describe, it, before } from "node:test";

import { createMemoryBillingStore } from "@/lib/billing/memory-store";

import { parseLemonWebhookPayload } from "@/lib/billing/parse-webhook";

import { processParsedWebhook } from "@/lib/billing/processor";

import { subscriptionGrantsPremium } from "@/lib/billing/types";

import { planByVariantId, verifyLemonSignature } from "@/lib/lemonsqueezy";



const USER_ID = "user_billing_1";

const USER_EMAIL = "billing@example.com";

const VARIANT_STARTER = "111001";

const VARIANT_PRO_TRIAL = "111099";

const SUB_ID = "sub_1001";



before(() => {

  process.env.LEMONSQUEEZY_STARTER_VARIANT_ID = VARIANT_STARTER;

  process.env.LEMONSQUEEZY_PRO_VARIANT_ID = "111002";

  process.env.LEMONSQUEEZY_PRO_TRIAL_VARIANT_ID = VARIANT_PRO_TRIAL;

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

  endsAt?: string;

  customerId?: string;

  dataType?: string;

  relatedSubscriptionId?: string;

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

      type: input.dataType,

      attributes: {

        status: input.status,

        variant_id: input.variantId ?? VARIANT_STARTER,

        user_email: input.email === null ? undefined : (input.email ?? USER_EMAIL),

        customer_id: input.customerId ?? "cust_9",

        renews_at: input.renewsAt ?? "2099-01-15T00:00:00.000Z",

        ends_at: input.endsAt,

        updated_at: input.updatedAt,

        subscription_id: input.relatedSubscriptionId,

        urls: { customer_portal: "https://example.com/portal" },

      },

      relationships: input.relatedSubscriptionId

        ? { subscription: { data: { id: input.relatedSubscriptionId } } }

        : undefined,

    },

  };

  const rawBody = JSON.stringify(body);

  const parsed = parseLemonWebhookPayload(rawBody, body);

  assert.ok(parsed);

  return { rawBody, parsed };

}



async function seedActive(store: ReturnType<typeof createMemoryBillingStore>) {

  await processParsedWebhook(

    store,

    lemonPayload({

      eventName: "subscription_created",

      status: "active",

      updatedAt: "2026-01-10T12:00:00.000Z",

      renewsAt: "2099-02-10T00:00:00.000Z",

    }).parsed,

  );

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



  it("maps pro trial variant to pro", () => {

    assert.equal(planByVariantId(VARIANT_PRO_TRIAL), "pro");

  });



  it("extends period on renewal / payment_success", async () => {

    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });

    await seedActive(store);



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



  it("retains paid access on payment_failed (past_due)", async () => {

    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });

    await seedActive(store);



    const failed = await processParsedWebhook(

      store,

      lemonPayload({

        eventName: "subscription_payment_failed",

        status: "past_due",

        updatedAt: "2026-01-12T12:00:00.000Z",

        renewsAt: "2099-02-10T00:00:00.000Z",

      }).parsed,

    );

    assert.ok("applied" in failed && failed.applied);

    if ("applied" in failed) assert.equal(failed.action, "retain_paid");



    const sub = store.subscriptions.get(SUB_ID)!;

    assert.equal(sub.plan, "starter");

    assert.equal(sub.status, "past_due");

    assert.equal(subscriptionGrantsPremium(sub), true);

    assert.equal(store.licenses.get(USER_ID)?.plan, "starter");

  });



  it("restores active on payment_recovered", async () => {

    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });

    await seedActive(store);

    await processParsedWebhook(

      store,

      lemonPayload({

        eventName: "subscription_payment_failed",

        status: "past_due",

        updatedAt: "2026-01-12T12:00:00.000Z",

      }).parsed,

    );



    const recovered = await processParsedWebhook(

      store,

      lemonPayload({

        eventName: "subscription_payment_recovered",

        status: "active",

        updatedAt: "2026-01-13T12:00:00.000Z",

        renewsAt: "2099-02-10T00:00:00.000Z",

      }).parsed,

    );

    assert.ok("applied" in recovered && recovered.applied);

    assert.equal(store.subscriptions.get(SUB_ID)!.status, "active");

    assert.equal(subscriptionGrantsPremium(store.subscriptions.get(SUB_ID)!), true);

  });



  it("keeps paid access through cancel-at-period-end", async () => {

    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });

    await seedActive(store);



    const cancel = await processParsedWebhook(

      store,

      lemonPayload({

        eventName: "subscription_cancelled",

        status: "cancelled",

        updatedAt: "2026-01-20T12:00:00.000Z",

        endsAt: "2099-02-10T00:00:00.000Z",

        renewsAt: "2099-02-10T00:00:00.000Z",

      }).parsed,

    );

    assert.ok("applied" in cancel && cancel.applied);

    if ("applied" in cancel) assert.equal(cancel.action, "cancel_at_period_end");



    const sub = store.subscriptions.get(SUB_ID)!;

    assert.equal(sub.plan, "starter");

    assert.equal(sub.status, "cancelled");

    assert.ok(sub.cancelledAt);

    assert.equal(subscriptionGrantsPremium(sub), true);

    assert.equal(store.licenses.get(USER_ID)?.plan, "starter");

  });



  it("resumes paid access after resume", async () => {

    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });

    await seedActive(store);

    await processParsedWebhook(

      store,

      lemonPayload({

        eventName: "subscription_cancelled",

        status: "cancelled",

        updatedAt: "2026-01-20T12:00:00.000Z",

        renewsAt: "2099-02-10T00:00:00.000Z",

      }).parsed,

    );



    const resume = await processParsedWebhook(

      store,

      lemonPayload({

        eventName: "subscription_resumed",

        status: "active",

        updatedAt: "2026-01-21T12:00:00.000Z",

        renewsAt: "2099-02-10T00:00:00.000Z",

      }).parsed,

    );

    assert.ok("applied" in resume && resume.applied);

    assert.equal(store.subscriptions.get(SUB_ID)!.status, "active");

    assert.equal(store.subscriptions.get(SUB_ID)!.cancelledAt, null);

  });



  it("soft-holds on pause and restores on unpause", async () => {

    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });

    await seedActive(store);



    const paused = await processParsedWebhook(

      store,

      lemonPayload({

        eventName: "subscription_paused",

        status: "paused",

        updatedAt: "2026-01-18T12:00:00.000Z",

      }).parsed,

    );

    assert.ok("applied" in paused && paused.applied);

    if ("applied" in paused) assert.equal(paused.action, "soft_hold");

    assert.equal(store.subscriptions.get(SUB_ID)!.plan, "starter");

    assert.equal(subscriptionGrantsPremium(store.subscriptions.get(SUB_ID)!), true);



    const unpaused = await processParsedWebhook(

      store,

      lemonPayload({

        eventName: "subscription_unpaused",

        status: "active",

        updatedAt: "2026-01-19T12:00:00.000Z",

      }).parsed,

    );

    assert.ok("applied" in unpaused && unpaused.applied);

    assert.equal(store.subscriptions.get(SUB_ID)!.status, "active");

  });



  it("revokes on expiration", async () => {

    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });

    await seedActive(store);



    const expired = await processParsedWebhook(

      store,

      lemonPayload({

        eventName: "subscription_expired",

        status: "expired",

        updatedAt: "2026-03-01T12:00:00.000Z",

        renewsAt: "2020-01-01T00:00:00.000Z",

      }).parsed,

    );

    assert.ok("applied" in expired && expired.applied);

    if ("applied" in expired) assert.equal(expired.action, "revoke");

    assert.equal(store.subscriptions.get(SUB_ID)!.plan, "free");

    assert.equal(subscriptionGrantsPremium(store.subscriptions.get(SUB_ID)!), false);

    assert.equal(store.licenses.get(USER_ID)?.plan, "free");

  });



  it("revokes on refund without destroying account row", async () => {

    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });

    await seedActive(store);



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

    // User still exists in store seed; only entitlement changed

    assert.equal(store.licenses.get(USER_ID)?.plan, "free");

  });



  it("ignores order_created (subscription events own entitlement)", async () => {

    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });

    const result = await processParsedWebhook(

      store,

      lemonPayload({

        eventName: "order_created",

        status: "paid",

        updatedAt: "2026-01-10T12:00:00.000Z",

        dataType: "orders",

        subscriptionId: "order_999",

      }).parsed,

    );

    assert.ok("ignored" in result && result.ignored);

    assert.equal(store.subscriptions.size, 0);

  });



  it("revokes via order_refunded using related subscription id", async () => {

    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });

    await seedActive(store);



    const refund = await processParsedWebhook(

      store,

      lemonPayload({

        eventName: "order_refunded",

        status: "refunded",

        updatedAt: "2026-01-26T12:00:00.000Z",

        dataType: "orders",

        subscriptionId: "order_abc",

        relatedSubscriptionId: SUB_ID,

      }).parsed,

    );

    assert.ok("applied" in refund && refund.applied);

    assert.equal(store.subscriptions.get(SUB_ID)!.plan, "free");

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

    assert.equal(verifyLemonSignature(body, "sha256=" + good), true);

    assert.equal(verifyLemonSignature(body, "deadbeef"), false);

    assert.equal(verifyLemonSignature(body, null), false);

  });



  it("ignores webhooks for unknown users without poisoning event id", async () => {

    const store = createMemoryBillingStore({ users: [] });

    const event = lemonPayload({

      eventName: "subscription_created",

      status: "active",

      updatedAt: "2026-01-10T12:00:00.000Z",

      userId: null,

      email: "nobody@example.com",

    });

    const result = await processParsedWebhook(store, event.parsed);

    assert.ok("ignored" in result && result.ignored);

    if ("ignored" in result) assert.equal(result.reason, "unknown_user");

    assert.equal(store.subscriptions.size, 0);

    assert.equal(store.events.has(event.parsed.eventId), false);



    // Later the user exists — same webhook can apply

    const store2 = createMemoryBillingStore({ users: [{ id: USER_ID, email: "nobody@example.com" }] });

    const retry = await processParsedWebhook(store2, event.parsed);

    assert.ok("applied" in retry && retry.applied);

  });



  it("ignores unknown / unmapped variants without poisoning", async () => {

    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });

    const event = lemonPayload({

      eventName: "subscription_created",

      status: "active",

      updatedAt: "2026-01-10T12:00:00.000Z",

      variantId: "999999",

    });

    const result = await processParsedWebhook(store, event.parsed);

    assert.ok("ignored" in result && result.ignored);

    if ("ignored" in result) assert.equal(result.reason, "unknown_variant");

    assert.equal(store.subscriptions.size, 0);

    assert.equal(store.events.has(event.parsed.eventId), false);

  });



  it("ignores unknown events", async () => {

    const store = createMemoryBillingStore({ users: [{ id: USER_ID, email: USER_EMAIL }] });

    const result = await processParsedWebhook(

      store,

      lemonPayload({

        eventName: "license_key_created",

        status: "active",

        updatedAt: "2026-01-10T12:00:00.000Z",

      }).parsed,

    );

    assert.ok("ignored" in result && result.ignored);

    assert.equal(store.subscriptions.size, 0);

  });



  it("returns null for malformed payloads missing event name", () => {

    const parsed = parseLemonWebhookPayload("{}", { data: { id: "x" } });

    assert.equal(parsed, null);

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

});


