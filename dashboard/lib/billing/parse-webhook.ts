import { createHash } from "crypto";
import { planByVariantId, type LemonWebhookPlan } from "@/lib/lemonsqueezy";
import {
  asString,
  normalizeLemonCustomData,
  tierFromMetadata,
  userIdFromCustom,
} from "@/lib/lemon-webhook-utils";
import {
  entitlementActionForLemon,
  normalizeLemonStatus,
} from "@/lib/subscription-entitlement";
import { buildLemonEventId, type ParsedLemonWebhook } from "@/lib/billing/types";

export type LemonWebhookJson = {
  meta?: {
    event_name?: string;
    custom_data?: unknown;
  };
  data?: {
    id?: string;
    attributes?: {
      status?: string;
      variant_id?: number | string;
      user_email?: string;
      customer_id?: number | string;
      renews_at?: string | null;
      ends_at?: string | null;
      created_at?: string | null;
      updated_at?: string | null;
      urls?: { customer_portal?: string | null };
      first_subscription_item?: { variant_id?: number | string };
      custom?: unknown;
    };
  };
};

function parseDate(raw: string | null | undefined): Date | null {
  const s = asString(raw);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolvePeriodEnd(attrs: NonNullable<LemonWebhookJson["data"]>["attributes"]): Date {
  const fromRenew = parseDate(attrs?.renews_at);
  if (fromRenew) return fromRenew;
  const fromEnds = parseDate(attrs?.ends_at);
  if (fromEnds) return fromEnds;
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

export function parseLemonWebhookPayload(rawBody: string, payload: LemonWebhookJson): ParsedLemonWebhook | null {
  const eventName = asString(payload.meta?.event_name);
  const providerSubscriptionId = asString(payload.data?.id);
  if (!eventName || !providerSubscriptionId) return null;

  const attrs = payload.data?.attributes || {};
  const variantId = String(attrs.variant_id || attrs.first_subscription_item?.variant_id || "").trim();
  const status = normalizeLemonStatus(asString(attrs.status) || "unknown");
  const custom = normalizeLemonCustomData(payload.meta?.custom_data ?? attrs.custom);
  const variantPlan = planByVariantId(variantId);
  const plan = tierFromMetadata(custom, variantPlan) as LemonWebhookPlan | "free";
  const providerUpdatedAt = parseDate(attrs.updated_at);
  const currentPeriodStart = parseDate(attrs.created_at);
  const currentPeriodEnd = resolvePeriodEnd(attrs);
  const action = entitlementActionForLemon({ eventName, status });

  const eventId = buildLemonEventId({
    eventName,
    providerSubscriptionId,
    status,
    providerUpdatedAt,
    rawBody,
  });

  return {
    eventName,
    eventId,
    providerSubscriptionId,
    providerCustomerId: asString(attrs.customer_id) || null,
    variantId,
    status,
    plan,
    userId: userIdFromCustom(custom) || null,
    email: asString(attrs.user_email).toLowerCase() || null,
    currentPeriodStart,
    currentPeriodEnd,
    customerPortalUrl: asString(attrs.urls?.customer_portal) || null,
    providerUpdatedAt,
    action,
    rawBody,
  };
}

/** Test helper — stable event id without full body. */
export function hashEventFallback(parts: string): string {
  return createHash("sha256").update(parts).digest("hex").slice(0, 16);
}
