/**
 * Billing store interface — Prisma in prod, in-memory in tests.
 */

import type { BillingSubscriptionRecord, ParsedLemonWebhook, WebhookProcessResult } from "@/lib/billing/types";
import { isStaleProviderUpdate } from "@/lib/billing/types";
import { FREE_LICENSE_FEATURES, FREE_PERPETUAL_EXPIRY } from "@/lib/free-license";
import { getFeatureByPlan } from "@/lib/feature-plans";

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

  // Claim before mutating entitlements — makes concurrent duplicates safe.
  const claimed = await store.claimEvent({
    eventId: event.eventId,
    eventName: event.eventName,
    rawBody: event.rawBody,
  });
  if (!claimed) {
    return { ok: true, duplicate: true };
  }

  try {
    return await applyClaimedWebhook(store, event);
  } catch (err) {
    await store.releaseEvent(event.eventId);
    throw err;
  }
}

async function applyClaimedWebhook(
  store: BillingStore,
  event: ParsedLemonWebhook,
): Promise<WebhookProcessResult> {
  let userId = event.userId;
  if (!userId && event.email) {
    userId = await store.findUserIdByEmail(event.email);
  }

  const existing = await store.findSubscriptionByProviderId(event.providerSubscriptionId);

  if (!userId && !existing) {
    await store.recordEvent({
      eventId: event.eventId,
      eventName: event.eventName,
      rawBody: event.rawBody,
    });
    return { ok: true, ignored: true, reason: "unknown_user" };
  }

  const resolvedUserId = userId || existing!.userId;

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

  if (event.action === "activate" || event.action === "retain_paid" || event.action === "soft_hold") {
    const planForActivate =
      event.action !== "activate" && existing && existing.plan !== "free"
        ? existing.plan
        : event.plan;

    // Unknown / unmapped variant must never grant paid access
    if (planForActivate === "free") {
      await store.recordEvent({
        eventId: event.eventId,
        eventName: event.eventName,
        rawBody: event.rawBody,
        subscriptionId: existing?.id,
      });
      return { ok: true, ignored: true, reason: "unknown_variant" };
    }

    const sub = await store.upsertSubscription({
      userId: resolvedUserId,
      providerSubscriptionId: event.providerSubscriptionId,
      providerCustomerId: event.providerCustomerId,
      variantId: event.variantId || existing?.variantId || null,
      plan: planForActivate,
      status: event.status,
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

  if (event.action === "revoke") {
    if (!existing && !userId) {
      await store.recordEvent({
        eventId: event.eventId,
        eventName: event.eventName,
        rawBody: event.rawBody,
      });
      return { ok: true, ignored: true, reason: "unknown_user" };
    }

    const sub = await store.upsertSubscription({
      userId: resolvedUserId,
      providerSubscriptionId: event.providerSubscriptionId,
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

  await store.recordEvent({
    eventId: event.eventId,
    eventName: event.eventName,
    rawBody: event.rawBody,
    subscriptionId: existing?.id,
  });
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
  const premium =
    sub.plan !== "free" &&
    !["cancelled", "expired", "refunded", "chargebacked"].includes(String(sub.status).toLowerCase());

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
