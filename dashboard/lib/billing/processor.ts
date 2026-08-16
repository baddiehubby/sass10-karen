/**
 * Billing store interface — Prisma in prod, in-memory in tests.
 *
 * Idempotency: claim unique event id → apply upserts → release claim on retryable failures.
 * Never permanently poison unknown_user / unknown_variant (release so Lemon can retry).
 */

import type { BillingSubscriptionRecord, ParsedLemonWebhook, WebhookProcessResult } from "@/lib/billing/types";
import { isStaleProviderUpdate } from "@/lib/billing/types";
import { FREE_LICENSE_FEATURES, FREE_PERPETUAL_EXPIRY } from "@/lib/free-license";
import { getFeatureByPlan } from "@/lib/feature-plans";
import { subscriptionGrantsPremium } from "@/lib/billing/types";

export type BillingStore = {
  hasProcessedEvent(eventId: string): Promise<boolean>;
  /** Insert event id first (unique). Returns false if another worker already claimed it. */
  claimEvent(input: {
    eventId: string;
    eventName: string;
    rawBody: string;
  }): Promise<boolean>;
  /** Release a claim so Lemon can safely retry after a hard failure. */
  releaseEvent(eventId: string): Promise<void>;
  recordEvent(input: {
    eventId: string;
    eventName: string;
    rawBody: string;
    licenseId?: string | null;
    subscriptionId?: string | null;
  }): Promise<void>;
  findUserIdByEmail(email: string): Promise<string | null>;
  findSubscriptionByProviderId(providerSubscriptionId: string): Promise<BillingSubscriptionRecord | null>;
  /** Latest Lemon subscription for a user (order refunds without subscription id). */
  findLatestSubscriptionForUser(userId: string): Promise<BillingSubscriptionRecord | null>;
  upsertSubscription(input: {
    userId: string;
    providerSubscriptionId: string;
    providerCustomerId: string | null;
    variantId: string | null;
    plan: string;
    status: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelledAt: Date | null;
    customerPortalUrl: string | null;
    providerUpdatedAt: Date | null;
  }): Promise<BillingSubscriptionRecord>;
  syncLicenseFromSubscription(sub: BillingSubscriptionRecord): Promise<string | null>;
};

export async function processParsedWebhook(
  store: BillingStore,
  event: ParsedLemonWebhook,
): Promise<WebhookProcessResult> {
  if (await store.hasProcessedEvent(event.eventId)) {
    return { ok: true, duplicate: true };
  }

  const claimed = await store.claimEvent({
    eventId: event.eventId,
    eventName: event.eventName,
    rawBody: event.rawBody,
  });
  if (!claimed) {
    return { ok: true, duplicate: true };
  }

  try {
    const result = await applyWebhook(store, event);
    if (shouldReleaseWebhookClaim(event, result)) {
      await store.releaseEvent(event.eventId);
    }
    return result;
  } catch (err) {
    await store.releaseEvent(event.eventId);
    throw err;
  }
}

/** Release claim when Lemon must be allowed to retry (do not permanently poison). */
function shouldReleaseWebhookClaim(
  event: ParsedLemonWebhook,
  result: WebhookProcessResult,
): boolean {
  if (!result.ok) return true;
  if ("duplicate" in result && result.duplicate) return false;
  if ("applied" in result && result.applied) return false;
  if ("stale" in result && result.stale) return false;
  if (!("ignored" in result) || !result.ignored) return false;
  const reason = "reason" in result ? String(result.reason ?? "") : "";
  const retryable = new Set([
    "unknown_user",
    "unknown_variant",
    "missing_subscription_id",
    "nothing_to_cancel",
  ]);
  if (retryable.has(reason)) return true;
  if (reason === "ignored_event" && event.eventName.toLowerCase() === "order_created") {
    return false;
  }
  if (reason === "ignored_event") return true;
  return false;
}

async function applyWebhook(
  store: BillingStore,
  event: ParsedLemonWebhook,
): Promise<WebhookProcessResult> {
  if (event.action === "ignore") {
    // Record no-ops that are intentionally skipped so Lemon does not retry forever
    if (event.eventName.toLowerCase() === "order_created") {
      await store.recordEvent({
        eventId: event.eventId,
        eventName: event.eventName,
        rawBody: event.rawBody,
      });
    }
    return { ok: true, ignored: true, reason: "ignored_event" };
  }

  let userId = event.userId;
  if (!userId && event.email) {
    userId = await store.findUserIdByEmail(event.email);
  }

  let existing = await store.findSubscriptionByProviderId(event.providerSubscriptionId);

  // order_refunded may arrive with order id as synthetic — resolve real subscription
  if (
    !existing &&
    event.eventName.toLowerCase().includes("refund") &&
    userId
  ) {
    existing = await store.findLatestSubscriptionForUser(userId);
  }
  if (
    !existing &&
    event.eventName.toLowerCase().includes("refund") &&
    !userId &&
    event.email
  ) {
    const byEmail = await store.findUserIdByEmail(event.email);
    if (byEmail) existing = await store.findLatestSubscriptionForUser(byEmail);
  }

  if (!userId && !existing) {
    // Do NOT record — Lemon may retry after the account exists / email matches
    return { ok: true, ignored: true, reason: "unknown_user" };
  }

  const resolvedUserId = userId || existing!.userId;
  const providerSubscriptionId =
    existing?.providerSubscriptionId ||
    (event.providerSubscriptionId.startsWith("order:") ? "" : event.providerSubscriptionId);

  if (!providerSubscriptionId && event.action === "revoke") {
    return { ok: true, ignored: true, reason: "missing_subscription_id" };
  }

  // Out-of-order: never regress a newer provider update
  if (existing && isStaleProviderUpdate(existing.providerUpdatedAt, event.providerUpdatedAt)) {
    await store.recordEvent({
      eventId: event.eventId,
      eventName: event.eventName,
      rawBody: event.rawBody,
      subscriptionId: existing.id,
    });
    return { ok: true, stale: true, reason: "out_of_order" };
  }

  if (
    event.action === "activate" ||
    event.action === "retain_paid" ||
    event.action === "soft_hold"
  ) {
    const planForActivate =
      event.action !== "activate" && existing && existing.plan !== "free"
        ? existing.plan
        : event.plan;

    if (planForActivate === "free") {
      // Do NOT record — env/variant may be fixed and Lemon will retry
      return { ok: true, ignored: true, reason: "unknown_variant" };
    }

    const sub = await store.upsertSubscription({
      userId: resolvedUserId,
      providerSubscriptionId: providerSubscriptionId || event.providerSubscriptionId,
      providerCustomerId: event.providerCustomerId ?? existing?.providerCustomerId ?? null,
      variantId: event.variantId || existing?.variantId || null,
      plan: planForActivate,
      status: event.status === "unknown" && event.action === "soft_hold" ? "paused" : event.status,
      currentPeriodStart: event.currentPeriodStart ?? existing?.currentPeriodStart ?? new Date(),
      currentPeriodEnd: event.currentPeriodEnd,
      cancelledAt: null,
      customerPortalUrl: event.customerPortalUrl ?? existing?.customerPortalUrl ?? null,
      providerUpdatedAt: event.providerUpdatedAt ?? existing?.providerUpdatedAt ?? null,
    });

    const licenseId = await store.syncLicenseFromSubscription(sub);
    await store.recordEvent({
      eventId: event.eventId,
      eventName: event.eventName,
      rawBody: event.rawBody,
      subscriptionId: sub.id,
      licenseId,
    });

    return {
      ok: true,
      applied: true,
      action: event.action,
      subscriptionId: sub.id,
      plan: sub.plan,
      status: sub.status,
    };
  }

  if (event.action === "cancel_at_period_end") {
    const paidPlan =
      (existing && existing.plan !== "free" ? existing.plan : null) ||
      (event.plan !== "free" ? event.plan : null) ||
      existing?.plan ||
      "free";

    if (paidPlan === "free" && !existing) {
      return { ok: true, ignored: true, reason: "nothing_to_cancel" };
    }

    const periodEnd =
      event.currentPeriodEnd ||
      existing?.currentPeriodEnd ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const sub = await store.upsertSubscription({
      userId: resolvedUserId,
      providerSubscriptionId: providerSubscriptionId || event.providerSubscriptionId,
      providerCustomerId: event.providerCustomerId ?? existing?.providerCustomerId ?? null,
      variantId: event.variantId || existing?.variantId || null,
      // Keep paid plan through the paid period — memories/settings untouched
      plan: paidPlan === "free" ? existing?.plan || "free" : paidPlan,
      status: "cancelled",
      currentPeriodStart: existing?.currentPeriodStart ?? event.currentPeriodStart,
      currentPeriodEnd: periodEnd,
      cancelledAt: new Date(),
      customerPortalUrl: event.customerPortalUrl ?? existing?.customerPortalUrl ?? null,
      providerUpdatedAt: event.providerUpdatedAt ?? existing?.providerUpdatedAt ?? null,
    });

    const licenseId = await store.syncLicenseFromSubscription(sub);
    await store.recordEvent({
      eventId: event.eventId,
      eventName: event.eventName,
      rawBody: event.rawBody,
      subscriptionId: sub.id,
      licenseId,
    });

    return {
      ok: true,
      applied: true,
      action: "cancel_at_period_end",
      subscriptionId: sub.id,
      plan: sub.plan,
      status: sub.status,
    };
  }

  if (event.action === "revoke") {
    if (!existing && !userId) {
      return { ok: true, ignored: true, reason: "unknown_user" };
    }

    const targetId =
      (existing?.providerSubscriptionId || providerSubscriptionId || "").trim() ||
      event.providerSubscriptionId;
    if (!targetId || targetId.startsWith("order:")) {
      return { ok: true, ignored: true, reason: "missing_subscription_id" };
    }

    const sub = await store.upsertSubscription({
      userId: resolvedUserId,
      providerSubscriptionId: targetId,
      providerCustomerId: event.providerCustomerId ?? existing?.providerCustomerId ?? null,
      variantId: event.variantId || existing?.variantId || null,
      plan: "free",
      status: event.status === "unknown" ? "cancelled" : event.status,
      currentPeriodStart: existing?.currentPeriodStart ?? null,
      currentPeriodEnd: existing?.currentPeriodEnd ?? event.currentPeriodEnd,
      cancelledAt: new Date(),
      customerPortalUrl: event.customerPortalUrl ?? existing?.customerPortalUrl ?? null,
      providerUpdatedAt: event.providerUpdatedAt ?? existing?.providerUpdatedAt ?? null,
    });

    const licenseId = await store.syncLicenseFromSubscription(sub);
    await store.recordEvent({
      eventId: event.eventId,
      eventName: event.eventName,
      rawBody: event.rawBody,
      subscriptionId: sub.id,
      licenseId,
    });

    return {
      ok: true,
      applied: true,
      action: "revoke",
      subscriptionId: sub.id,
      plan: "free",
      status: sub.status,
    };
  }

  return { ok: true, ignored: true, reason: "unhandled_action" };
}

/** Shared license sync shape for Prisma + memory stores. */
export function licensePayloadFromSubscription(sub: BillingSubscriptionRecord): {
  plan: string;
  features: string;
  expiresAt: Date;
  activatedAt: Date;
  lemonSqueezyId: string;
  lemonSqueezySubscriptionId: string;
  lemonSqueezyVariantId: string | null;
  lemonSqueezySubscriptionStatus: string;
  lemonSqueezyCustomerPortalUrl: string | null;
} {
  const premium = subscriptionGrantsPremium(sub);

  if (!premium) {
    return {
      plan: "free",
      features: JSON.stringify(FREE_LICENSE_FEATURES),
      expiresAt: FREE_PERPETUAL_EXPIRY,
      activatedAt: new Date(),
      lemonSqueezyId: sub.providerSubscriptionId,
      lemonSqueezySubscriptionId: sub.providerSubscriptionId,
      lemonSqueezyVariantId: sub.variantId,
      lemonSqueezySubscriptionStatus: sub.status,
      lemonSqueezyCustomerPortalUrl: sub.customerPortalUrl,
    };
  }

  return {
    plan: sub.plan,
    features: JSON.stringify(getFeatureByPlan(sub.plan)),
    expiresAt: sub.currentPeriodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    activatedAt: new Date(),
    lemonSqueezyId: sub.providerSubscriptionId,
    lemonSqueezySubscriptionId: sub.providerSubscriptionId,
    lemonSqueezyVariantId: sub.variantId,
    lemonSqueezySubscriptionStatus: sub.status,
    lemonSqueezyCustomerPortalUrl: sub.customerPortalUrl,
  };
}

