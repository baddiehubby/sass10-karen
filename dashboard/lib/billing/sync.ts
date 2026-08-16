/**
 * Soft sync from Lemon API — never destroys valid entitlement if Lemon is down.
 */

import { lemonRequest, planByVariantId } from "@/lib/lemonsqueezy";
import { createPrismaBillingStore } from "@/lib/billing/prisma-store";
import { normalizeLemonStatus } from "@/lib/subscription-entitlement";
import { prisma } from "@/lib/prisma";

export type SyncResult =
  | { ok: true; synced: true; status: string; plan: string }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string; preserved: true };

export async function syncSubscriptionFromLemon(userId: string): Promise<SyncResult> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, provider: "lemonsqueezy" },
    orderBy: { updatedAt: "desc" },
  });
  if (!sub?.providerSubscriptionId) {
    return { ok: true, skipped: true, reason: "no_subscription" };
  }

  let response: Response;
  try {
    response = await lemonRequest(`/subscriptions/${sub.providerSubscriptionId}`);
  } catch {
    return { ok: false, error: "lemon_unreachable", preserved: true };
  }

  if (!response.ok) {
    // Do not revoke on temporary Lemon failures
    return { ok: false, error: `lemon_http_${response.status}`, preserved: true };
  }

  const payload = (await response.json()) as {
    data?: {
      id?: string;
      attributes?: {
        status?: string;
        variant_id?: number | string;
        renews_at?: string | null;
        ends_at?: string | null;
        updated_at?: string | null;
        customer_id?: number | string;
        urls?: { customer_portal?: string | null };
      };
    };
  };

  const attrs = payload.data?.attributes;
  if (!attrs) {
    return { ok: false, error: "lemon_empty", preserved: true };
  }

  const status = normalizeLemonStatus(attrs.status);
  const variantId = String(attrs.variant_id || "").trim();
  const plan = planByVariantId(variantId);
  const store = createPrismaBillingStore();

  const renews = attrs.renews_at || attrs.ends_at;
  const currentPeriodEnd = renews ? new Date(renews) : sub.currentPeriodEnd;
  const providerUpdatedAt = attrs.updated_at ? new Date(attrs.updated_at) : new Date();

  const revoke =
    status === "cancelled" ||
    status === "expired" ||
    status === "refunded" ||
    status === "chargebacked";

  const updated = await store.upsertSubscription({
    userId,
    providerSubscriptionId: sub.providerSubscriptionId,
    providerCustomerId: attrs.customer_id != null ? String(attrs.customer_id) : sub.providerCustomerId,
    variantId: variantId || sub.variantId,
    plan: revoke ? "free" : plan === "free" ? sub.plan : plan,
    status,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd,
    cancelledAt: revoke ? new Date() : null,
    customerPortalUrl: attrs.urls?.customer_portal ?? sub.customerPortalUrl,
    providerUpdatedAt,
  });

  await store.syncLicenseFromSubscription(updated);
  return { ok: true, synced: true, status: updated.status, plan: updated.plan };
}
