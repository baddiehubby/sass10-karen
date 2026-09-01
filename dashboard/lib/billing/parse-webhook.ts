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

    id?: string | number;

    type?: string;

    attributes?: {

      status?: string;

      variant_id?: number | string;

      user_email?: string;

      customer_id?: number | string;

      renews_at?: string | null;

      ends_at?: string | null;

      created_at?: string | null;

      updated_at?: string | null;

      /** Present on some order payloads */

      subscription_id?: number | string | null;

      first_subscription_item?: {

        variant_id?: number | string;

        subscription_id?: number | string;

      };

      first_order_item?: {

        variant_id?: number | string;

        subscription_id?: number | string;

      };

      urls?: { customer_portal?: string | null };

      custom?: unknown;

    };

    relationships?: {

      subscription?: { data?: { id?: string | number } | null };

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



/**

 * Resolve the Lemon subscription id used as our providerSubscriptionId.

 * Order events use order ids in data.id — never upsert Subscription on an order id.

 */

export function resolveProviderSubscriptionId(

  eventName: string,

  payload: LemonWebhookJson,

): string {

  const event = eventName.trim().toLowerCase();

  const attrs = payload.data?.attributes || {};

  const fromAttrs = asString(attrs.subscription_id);

  const fromItem = asString(

    attrs.first_subscription_item?.subscription_id || attrs.first_order_item?.subscription_id,

  );

  const fromRel = asString(payload.data?.relationships?.subscription?.data?.id);

  const dataId = asString(payload.data?.id);

  const dataType = asString(payload.data?.type).toLowerCase();



  if (event.startsWith("order_") || dataType === "orders") {

    return fromAttrs || fromItem || fromRel || "";

  }



  return dataId || fromAttrs || fromItem || fromRel || "";

}



export function parseLemonWebhookPayload(rawBody: string, payload: LemonWebhookJson): ParsedLemonWebhook | null {

  const eventName = asString(payload.meta?.event_name);

  if (!eventName) return null;



  const providerSubscriptionId = resolveProviderSubscriptionId(eventName, payload);

  // order_created without a subscription id is a no-op (ignore path needs a stable id for logging only)

  const syntheticId =

    !providerSubscriptionId && eventName.toLowerCase() === "order_created"

      ? `order:${asString(payload.data?.id) || createHash("sha256").update(rawBody.slice(0, 120)).digest("hex").slice(0, 12)}`

      : "";

  const resolvedSubId = providerSubscriptionId || syntheticId;

  if (!resolvedSubId) return null;



  const attrs = payload.data?.attributes || {};

  const variantId = String(

    attrs.variant_id ||

      attrs.first_subscription_item?.variant_id ||

      attrs.first_order_item?.variant_id ||

      "",

  ).trim();

  const status = normalizeLemonStatus(asString(attrs.status) || "unknown");

  const custom = normalizeLemonCustomData(payload.meta?.custom_data ?? attrs.custom);

  const variantPlan = planByVariantId(variantId);

  const plan = tierFromMetadata(custom, variantPlan) as LemonWebhookPlan | "free";

  const providerUpdatedAt = parseDate(attrs.updated_at);

  const currentPeriodStart = parseDate(attrs.created_at);

  const currentPeriodEnd = resolvePeriodEnd(attrs);

  const action = entitlementActionForLemon({ eventName, status });



  // order_refunded without a resolvable subscription id cannot safely revoke

  if (eventName.toLowerCase() === "order_refunded" && !providerSubscriptionId) {

    // Still parse so processor can try email → latest subscription lookup via empty id sentinel

  }



  const eventId = buildLemonEventId({

    eventName,

    providerSubscriptionId: resolvedSubId,

    status,

    providerUpdatedAt,

    rawBody,

  });



  return {

    eventName,

    eventId,

    providerSubscriptionId: resolvedSubId,

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


