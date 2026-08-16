/**

 * Server-authoritative Lemon subscription → entitlement decisions.

 * Browser checkout success is never enough by itself.

 */



export type LemonSubscriptionStatus =

  | "active"

  | "on_trial"

  | "paused"

  | "past_due"

  | "unpaid"

  | "cancelled"

  | "expired"

  | "refunded"

  | "chargebacked"

  | "unknown";



export type EntitlementAction =

  | "activate"

  | "retain_paid"

  | "soft_hold"

  | "cancel_at_period_end"

  | "revoke"

  | "ignore";



const KNOWN_SUBSCRIPTION_EVENTS = new Set([

  "subscription_created",

  "subscription_updated",

  "subscription_cancelled",

  "subscription_canceled",

  "subscription_resumed",

  "subscription_expired",

  "subscription_paused",

  "subscription_unpaused",

  "subscription_payment_failed",

  "subscription_payment_success",

  "subscription_payment_recovered",

  "subscription_payment_refunded",

  "order_created",

  "order_refunded",

]);



export function normalizeLemonStatus(raw: string | null | undefined): LemonSubscriptionStatus {

  const s = (raw || "").trim().toLowerCase();

  if (s === "canceled") return "cancelled";

  if (s === "trialing") return "on_trial";

  if (

    s === "active" ||

    s === "on_trial" ||

    s === "paused" ||

    s === "past_due" ||

    s === "unpaid" ||

    s === "cancelled" ||

    s === "expired" ||

    s === "refunded" ||

    s === "chargebacked"

  ) {

    return s;

  }

  return "unknown";

}



/**

 * Map Lemon event + status → how we treat Subscription / License entitlements.

 * Status wins over event name when they disagree (except hard money reversals).

 *

 * Cancelled ≠ immediate revoke: Lemon cancel-at-period-end keeps access until ends_at.

 */

export function entitlementActionForLemon(input: {

  eventName: string;

  status: string | null | undefined;

}): EntitlementAction {

  const event = input.eventName.trim().toLowerCase();

  const status = normalizeLemonStatus(input.status);



  // Explicit money-reversal — immediate revoke (preserve account/memories; entitlement only)

  if (

    event.includes("refund") ||

    event.includes("chargeback") ||

    status === "refunded" ||

    status === "chargebacked"

  ) {

    return "revoke";

  }



  // Unknown event names never grant or mutate entitlement

  if (!KNOWN_SUBSCRIPTION_EVENTS.has(event)) {

    return "ignore";

  }



  // Period truly over

  if (event === "subscription_expired" || status === "expired") {

    return "revoke";

  }



  // Cancel / cancel-at-period-end — keep paid plan until currentPeriodEnd

  if (

    event === "subscription_cancelled" ||

    event === "subscription_canceled" ||

    status === "cancelled"

  ) {

    return "cancel_at_period_end";

  }



  if (status === "paused" || event === "subscription_paused") {

    return "soft_hold";

  }



  if (status === "past_due" || status === "unpaid" || event === "subscription_payment_failed") {
    return "retain_paid";
  }

  // Known paid-active statuses
  if (status === "active" || status === "on_trial") {
    return "activate";
  }

  // Explicit reactivation / payment events (status already handled above when known)
  if (
    event === "subscription_created" ||
    event === "subscription_resumed" ||
    event === "subscription_unpaused" ||
    event === "subscription_payment_success" ||
    event === "subscription_payment_recovered"
  ) {
    return "activate";
  }

  // subscription_updated with unknown/unhandled status must not invent entitlement
  if (event === "subscription_updated") {
    return "ignore";
  }

  // order_created is informational — subscription_* events own entitlement
  if (event === "order_created") {
    return "ignore";
  }

  return "ignore";
}



/**

 * Paid plan features remain available for these stored statuses.

 * Cancelled is included because access continues until License.expiresAt / Subscription.currentPeriodEnd.

 */

export function lemonStatusGrantsAccess(status: string | null | undefined): boolean {

  const s = normalizeLemonStatus(status);

  return (

    s === "active" ||

    s === "on_trial" ||

    s === "past_due" ||

    s === "unpaid" ||

    s === "paused" ||

    s === "cancelled"

  );

}



export function consumerSubscriptionLabel(input: {

  plan: string;

  status: string | null | undefined;

  expiresAt?: Date | string | null;

}): string {

  const plan = input.plan.trim().toLowerCase();

  if (plan === "free") return "Sacred Day";

  const status = normalizeLemonStatus(input.status);

  if (input.expiresAt) {

    const exp = typeof input.expiresAt === "string" ? new Date(input.expiresAt) : input.expiresAt;

    if (Number.isFinite(exp.getTime()) && exp.getTime() < Date.now() && plan !== "free") {

      return "Expired";

    }

  }

  if (status === "on_trial") return "Trialing";

  if (status === "past_due") return "Past due";

  if (status === "paused") return "Paused";

  if (status === "cancelled") return "Cancels at period end";

  if (status === "expired") return "Expired";

  if (status === "refunded") return "Refunded";

  if (status === "chargebacked") return "Closed";

  if (status === "active" || status === "unknown") {

    if (plan === "starter") return "Starter";

    if (plan === "pro") return "Pro";

    if (plan === "premium" || plan === "agency") return "Premium";

    return "Member";

  }

  return "Sacred Day";

}


