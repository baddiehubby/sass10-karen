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

export type EntitlementAction = "activate" | "retain_paid" | "soft_hold" | "revoke";

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
 * Map Lemon event + status → how we treat License.plan entitlements.
 * Status wins over event name when they disagree.
 */
export function entitlementActionForLemon(input: {
  eventName: string;
  status: string | null | undefined;
}): EntitlementAction {
  const event = input.eventName.trim().toLowerCase();
  const status = normalizeLemonStatus(input.status);

  // Explicit money-reversal events
  if (
    event.includes("refund") ||
    event.includes("chargeback") ||
    status === "refunded" ||
    status === "chargebacked"
  ) {
    return "revoke";
  }

  if (
    event === "subscription_expired" ||
    event === "subscription_cancelled" ||
    status === "expired" ||
    status === "cancelled"
  ) {
    return "revoke";
  }

  if (status === "paused" || event === "subscription_paused") {
    return "soft_hold";
  }

  if (status === "past_due" || status === "unpaid" || event === "subscription_payment_failed") {
    return "retain_paid";
  }

  if (
    status === "active" ||
    status === "on_trial" ||
    event === "subscription_created" ||
    event === "subscription_resumed" ||
    event === "subscription_payment_success" ||
    event === "subscription_payment_recovered" ||
    event === "subscription_updated"
  ) {
    return "activate";
  }

  return "soft_hold";
}

/** Paid plan features remain available for these stored statuses. */
export function lemonStatusGrantsAccess(status: string | null | undefined): boolean {
  const s = normalizeLemonStatus(status);
  return s === "active" || s === "on_trial" || s === "past_due" || s === "paused" || s === "unknown";
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
  if (status === "cancelled") return "Cancelled";
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
