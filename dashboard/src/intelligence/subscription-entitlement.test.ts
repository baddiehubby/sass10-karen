import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  entitlementActionForLemon,
  lemonStatusGrantsAccess,
  normalizeLemonStatus,
  consumerSubscriptionLabel,
} from "@/lib/subscription-entitlement";

describe("Lemon entitlement actions", () => {
  it("activates on active / trial statuses", () => {
    assert.equal(entitlementActionForLemon({ eventName: "subscription_updated", status: "active" }), "activate");
    assert.equal(entitlementActionForLemon({ eventName: "subscription_updated", status: "on_trial" }), "activate");
    assert.equal(entitlementActionForLemon({ eventName: "subscription_created", status: "active" }), "activate");
  });

  it("revokes on cancelled / expired / refund / chargeback", () => {
    assert.equal(entitlementActionForLemon({ eventName: "subscription_updated", status: "cancelled" }), "revoke");
    assert.equal(entitlementActionForLemon({ eventName: "subscription_expired", status: "expired" }), "revoke");
    assert.equal(entitlementActionForLemon({ eventName: "order_refunded", status: "refunded" }), "revoke");
    assert.equal(entitlementActionForLemon({ eventName: "subscription_payment_refunded", status: "active" }), "revoke");
  });

  it("retains paid on past_due and soft-holds paused", () => {
    assert.equal(entitlementActionForLemon({ eventName: "subscription_updated", status: "past_due" }), "retain_paid");
    assert.equal(entitlementActionForLemon({ eventName: "subscription_paused", status: "paused" }), "soft_hold");
  });

  it("normalizes aliases", () => {
    assert.equal(normalizeLemonStatus("canceled"), "cancelled");
    assert.equal(normalizeLemonStatus("trialing"), "on_trial");
  });

  it("access grants match product rules", () => {
    assert.equal(lemonStatusGrantsAccess("active"), true);
    assert.equal(lemonStatusGrantsAccess("past_due"), true);
    assert.equal(lemonStatusGrantsAccess("paused"), true);
    assert.equal(lemonStatusGrantsAccess("cancelled"), false);
    assert.equal(lemonStatusGrantsAccess("expired"), false);
  });

  it("labels Sacred Day for free bootstrap", () => {
    assert.equal(consumerSubscriptionLabel({ plan: "free", status: "free" }), "Sacred Day");
  });
});
