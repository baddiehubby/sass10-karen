/**
 * Pure decision logic for the Karen VIP Lemon Squeezy webhook.
 * Kept free of Prisma / Next so the billing rules are unit-testable offline.
 * (Behavior is identical to the sets that used to live inline in the route.)
 */

/** Optional order events (if Lemon also fires them on first sub invoice). */
const ORDER_ACTIVATE_EVENTS = new Set(["order_created", "order_paid"]);

/** Karen VIP $19/mo subscription activation. */
const SUB_ACTIVATE_EVENTS = new Set([
  "subscription_created",
  "subscription_resumed",
  "subscription_unpaused",
  "subscription_payment_success",
]);

const REVOKE_EVENTS = new Set([
  "order_refunded",
  "subscription_cancelled",
  "subscription_expired",
  "subscription_payment_failed",
  "subscription_paused",
]);

const UPDATED_ACTIVE_STATUSES = new Set(["active", "on_trial", "paid"]);

export type KarenLemonEventClass = "activate" | "revoke" | "unhandled";

/** Activation wins over revocation, exactly as the route always behaved. */
export function classifyKarenLemonEvent(eventName: string, status: string): KarenLemonEventClass {
  const ev = eventName.trim().toLowerCase();
  const st = status.trim().toLowerCase();
  if (
    ORDER_ACTIVATE_EVENTS.has(ev) ||
    SUB_ACTIVATE_EVENTS.has(ev) ||
    (ev === "subscription_updated" && UPDATED_ACTIVE_STATUSES.has(st))
  ) {
    return "activate";
  }
  if (REVOKE_EVENTS.has(ev)) return "revoke";
  return "unhandled";
}

/** Guest checkouts carry a random `guest_…` id — there is no User row to update. */
export function isGuestLemonUserId(userId: string): boolean {
  return !userId || userId.length < 8 || userId.startsWith("guest_");
}
