/**

 * Soft sync from Lemon API — never destroys valid entitlement if Lemon is down.

 * Cancel-at-period-end must NOT immediately revoke (matches webhook processor).

 */



import { lemonRequest, planByVariantId } from "@/lib/lemonsqueezy";

import { createPrismaBillingStore } from "@/lib/billing/prisma-store";

import { entitlementActionForLemon, normalizeLemonStatus } from "@/lib/subscription-entitlement";

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

  const mappedPlan = planByVariantId(variantId);

  const action = entitlementActionForLemon({

    eventName: "subscription_updated",

    status,

  });

  const store = createPrismaBillingStore();



  const renews = attrs.renews_at || attrs.ends_at;

  const currentPeriodEnd = renews ? new Date(renews) : sub.currentPeriodEnd;

  const providerUpdatedAt = attrs.updated_at ? new Date(attrs.updated_at) : new Date();



  // Never reassign ownership — soft sync is bound to the calling userId.

  const ownerUserId = sub.userId;



  let nextPlan = sub.plan;

  let nextStatus: string = status;

  let cancelledAt: Date | null = sub.cancelledAt;



  if (action === "revoke") {

    nextPlan = "free";

    cancelledAt = new Date();

    if (status === "unknown") nextStatus = "expired";

  } else if (action === "cancel_at_period_end") {

    // Keep paid plan through period end — do not demote to free here.

    nextPlan = sub.plan !== "free" ? sub.plan : mappedPlan === "free" ? sub.plan : mappedPlan;

    nextStatus = "cancelled";

    cancelledAt = sub.cancelledAt ?? new Date();

  } else if (action === "soft_hold") {

    nextPlan = sub.plan !== "free" ? sub.plan : mappedPlan === "free" ? sub.plan : mappedPlan;

    nextStatus = "paused";

    cancelledAt = null;

  } else if (action === "retain_paid") {

    nextPlan = sub.plan !== "free" ? sub.plan : mappedPlan === "free" ? sub.plan : mappedPlan;

    nextStatus = status === "unpaid" ? "unpaid" : status === "past_due" ? "past_due" : status;

    cancelledAt = null;

  } else if (action === "activate") {

    nextPlan = mappedPlan === "free" ? (sub.plan !== "free" ? sub.plan : "free") : mappedPlan;

    if (nextPlan === "free") {

      // Unknown variant from Lemon — preserve local entitlement

      return { ok: true, skipped: true, reason: "unknown_variant_preserved" };

    }

    nextStatus = status === "unknown" ? "active" : status;

    cancelledAt = null;

  } else {

    // ignore / unknown — preserve local state

    return { ok: true, skipped: true, reason: "status_ignored_preserved" };

  }



  const updated = await store.upsertSubscription({

    userId: ownerUserId,

    providerSubscriptionId: sub.providerSubscriptionId,

    providerCustomerId: attrs.customer_id != null ? String(attrs.customer_id) : sub.providerCustomerId,

    variantId: variantId || sub.variantId,

    plan: nextPlan,

    status: nextStatus,

    currentPeriodStart: sub.currentPeriodStart,

    currentPeriodEnd,

    cancelledAt,

    customerPortalUrl: attrs.urls?.customer_portal ?? sub.customerPortalUrl,

    providerUpdatedAt,

  });



  await store.syncLicenseFromSubscription(updated);

  return { ok: true, synced: true, status: updated.status, plan: updated.plan };

}


