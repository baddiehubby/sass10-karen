import assert from "node:assert/strict";

import { describe, it } from "node:test";

import {

  entitlementActionForLemon,

  lemonStatusGrantsAccess,

  normalizeLemonStatus,

  consumerSubscriptionLabel,

} from "@/lib/subscription-entitlement";

import { subscriptionGrantsPremium } from "@/lib/billing/types";



describe("Lemon entitlement actions", () => {

  it("activates on active / trial statuses", () => {

    assert.equal(entitlementActionForLemon({ eventName: "subscription_updated", status: "active" }), "activate");

    assert.equal(entitlementActionForLemon({ eventName: "subscription_updated", status: "on_trial" }), "activate");

    assert.equal(entitlementActionForLemon({ eventName: "subscription_created", status: "active" }), "activate");

    assert.equal(entitlementActionForLemon({ eventName: "subscription_unpaused", status: "active" }), "activate");

    assert.equal(

      entitlementActionForLemon({ eventName: "subscription_payment_recovered", status: "active" }),

      "activate",

    );

  });



  it("cancels at period end — does not immediate-revoke", () => {

    assert.equal(

      entitlementActionForLemon({ eventName: "subscription_updated", status: "cancelled" }),

      "cancel_at_period_end",

    );

    assert.equal(

      entitlementActionForLemon({ eventName: "subscription_cancelled", status: "cancelled" }),

      "cancel_at_period_end",

    );

  });



  it("revokes on expired / refund / chargeback", () => {

    assert.equal(entitlementActionForLemon({ eventName: "subscription_expired", status: "expired" }), "revoke");

    assert.equal(entitlementActionForLemon({ eventName: "order_refunded", status: "refunded" }), "revoke");

    assert.equal(

      entitlementActionForLemon({ eventName: "subscription_payment_refunded", status: "active" }),

      "revoke",

    );

  });



  it("retains paid on past_due and soft-holds paused", () => {

    assert.equal(entitlementActionForLemon({ eventName: "subscription_updated", status: "past_due" }), "retain_paid");

    assert.equal(entitlementActionForLemon({ eventName: "subscription_payment_failed", status: "past_due" }), "retain_paid");

    assert.equal(entitlementActionForLemon({ eventName: "subscription_paused", status: "paused" }), "soft_hold");

  });



  it("ignores unknown events and order_created", () => {

    assert.equal(entitlementActionForLemon({ eventName: "order_created", status: "paid" }), "ignore");

    assert.equal(entitlementActionForLemon({ eventName: "something_weird", status: "mystery" }), "ignore");

  });



  it("normalizes aliases", () => {

    assert.equal(normalizeLemonStatus("canceled"), "cancelled");

    assert.equal(normalizeLemonStatus("trialing"), "on_trial");

  });



  it("access grants match product rules", () => {

    assert.equal(lemonStatusGrantsAccess("active"), true);

    assert.equal(lemonStatusGrantsAccess("past_due"), true);

    assert.equal(lemonStatusGrantsAccess("paused"), true);

    assert.equal(lemonStatusGrantsAccess("cancelled"), true); // until period end (expiresAt)

    assert.equal(lemonStatusGrantsAccess("expired"), false);

    assert.equal(lemonStatusGrantsAccess("unknown"), false);

  });



  it("cancelled still grants premium until period end", () => {

    assert.equal(

      subscriptionGrantsPremium({

        plan: "starter",

        status: "cancelled",

        currentPeriodEnd: new Date("2099-06-01T00:00:00.000Z"),

        now: new Date("2026-01-01T00:00:00.000Z"),

      }),

      true,

    );

    assert.equal(

      subscriptionGrantsPremium({

        plan: "starter",

        status: "cancelled",

        currentPeriodEnd: new Date("2020-01-01T00:00:00.000Z"),

        now: new Date("2026-01-01T00:00:00.000Z"),

      }),

      false,

    );

  });



  it("labels Sacred Day for free bootstrap", () => {

    assert.equal(consumerSubscriptionLabel({ plan: "free", status: "free" }), "Sacred Day");

  });

});


