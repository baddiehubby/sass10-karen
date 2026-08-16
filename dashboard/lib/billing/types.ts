import { createHash } from "crypto";
import type { LemonWebhookPlan } from "@/lib/lemonsqueezy";
import type { EntitlementAction, LemonSubscriptionStatus } from "@/lib/subscription-entitlement";

export type BillingSubscriptionRecord = {
  id: string;
  userId: string;
  provider: "lemonsqueezy";
  providerCustomerId: string | null;
  providerSubscriptionId: string;
  variantId: string | null;
  plan: string;
  status: LemonSubscriptionStatus | string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelledAt: Date | null;
  customerPortalUrl: string | null;
  providerUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ParsedLemonWebhook = {
  eventName: string;
  eventId: string;
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  variantId: string;
  status: LemonSubscriptionStatus;
  plan: LemonWebhookPlan | "free";
  userId: string | null;
  email: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  customerPortalUrl: string | null;
  providerUpdatedAt: Date | null;
  action: EntitlementAction;
  rawBody: string;
};

export type WebhookProcessResult =
  | { ok: true; duplicate: true }
  | { ok: true; ignored: true; reason: string }
  | { ok: true; applied: true; action: EntitlementAction; subscriptionId: string; plan: string; status: string }
  | { ok: true; stale: true; reason: string }
  | { ok: false; error: string; httpStatus: number };

export function buildLemonEventId(input: {
  eventName: string;
  providerSubscriptionId: string;
  status: string;
  providerUpdatedAt: Date | null;
  rawBody: string;
}): string {
  const timePart = input.providerUpdatedAt
    ? input.providerUpdatedAt.toISOString()
    : `stable-${createHash("sha256")
        .update(`${input.eventName}:${input.providerSubscriptionId}:${input.status}:${input.rawBody.slice(0, 200)}`)
        .digest("hex")
        .slice(0, 16)}`;
  return [input.eventName, input.providerSubscriptionId, timePart].join(":");
}

/** True when incoming event is older than stored subscription (out-of-order). */
export function isStaleProviderUpdate(
  existing: Date | null | undefined,
  incoming: Date | null | undefined,
): boolean {
  if (!existing || !incoming) return false;
  return incoming.getTime() < existing.getTime();
}

export function subscriptionGrantsPremium(sub: {
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
  now?: Date;
}): boolean {
  const now = sub.now ?? new Date();
  const plan = sub.plan.trim().toLowerCase();
  if (!plan || plan === "free") return false;
  const status = sub.status.trim().toLowerCase();

  // Hard ends — never grant
  if (status === "expired" || status === "refunded" || status === "chargebacked") {
    return false;
  }

  // Cancel-at-period-end: keep access until Lemon ends_at / renews_at
  if (status === "cancelled" || status === "canceled") {
    if (!sub.currentPeriodEnd) return false;
    return sub.currentPeriodEnd.getTime() > now.getTime();
  }

  if (status === "active" || status === "on_trial" || status === "past_due" || status === "paused") {
    if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() <= now.getTime()) return false;
    return true;
  }
  return false;
}
