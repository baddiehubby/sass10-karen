import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { asIdString } from "@/lib/lemon-webhook-utils";

import { classifyKarenLemonEvent, isGuestLemonUserId } from "./lemon-webhook-decision";

describe("Lemon id parsing (regression: numeric ids were dropped)", () => {
  it("accepts numeric and string ids, rejects junk", () => {
    assert.equal(asIdString(424242), "424242");
    assert.equal(asIdString(" 424242 "), "424242");
    assert.equal(asIdString("424242"), "424242");
    assert.equal(asIdString(null), "");
    assert.equal(asIdString(undefined), "");
    assert.equal(asIdString({}), "");
    assert.equal(asIdString(1.5), "");
    assert.equal(asIdString(Number.NaN), "");
    assert.equal(asIdString(Number.MAX_SAFE_INTEGER + 10), "");
  });
});

describe("Karen VIP webhook decision", () => {
  it("activates on every purchase / renewal / resume event", () => {
    for (const ev of [
      "order_created",
      "order_paid",
      "subscription_created",
      "subscription_resumed",
      "subscription_unpaused",
      "subscription_payment_success",
    ]) {
      assert.equal(classifyKarenLemonEvent(ev, ""), "activate", ev);
    }
  });

  it("revokes on refund / cancel / expiry / failed payment / pause", () => {
    for (const ev of [
      "order_refunded",
      "subscription_cancelled",
      "subscription_expired",
      "subscription_payment_failed",
      "subscription_paused",
    ]) {
      assert.equal(classifyKarenLemonEvent(ev, ""), "revoke", ev);
    }
  });

  it("subscription_updated only activates for paying statuses", () => {
    for (const s of ["active", "on_trial", "paid", "ACTIVE", " active "]) {
      assert.equal(classifyKarenLemonEvent("subscription_updated", s), "activate", s);
    }
    for (const s of ["cancelled", "expired", "past_due", "paused", "unpaid", ""]) {
      assert.equal(classifyKarenLemonEvent("subscription_updated", s), "unhandled", s);
    }
  });

  it("ignores unknown events and is case-insensitive on event names", () => {
    assert.equal(classifyKarenLemonEvent("license_key_created", "active"), "unhandled");
    assert.equal(classifyKarenLemonEvent("", ""), "unhandled");
    assert.equal(classifyKarenLemonEvent("SUBSCRIPTION_CREATED", ""), "activate");
  });

  it("a cancelled status never activates via order events' status", () => {
    // status is irrelevant for explicit activate events; revoke events stay revoke.
    assert.equal(classifyKarenLemonEvent("subscription_cancelled", "active"), "revoke");
  });

  it("treats guest / short / empty user ids as non-users", () => {
    assert.equal(isGuestLemonUserId(""), true);
    assert.equal(isGuestLemonUserId("abc"), true);
    assert.equal(isGuestLemonUserId("guest_12345678"), true);
    assert.equal(isGuestLemonUserId("cm0realuserid123"), false);
  });
});
