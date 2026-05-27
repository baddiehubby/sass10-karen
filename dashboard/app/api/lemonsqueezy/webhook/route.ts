import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getFeatureByPlan } from "@/lib/feature-plans";
import { FREE_LICENSE_FEATURES, FREE_PERPETUAL_EXPIRY } from "@/lib/free-license";
import { planByVariantId, verifyLemonSignature } from "@/lib/lemonsqueezy";
import {
  asString,
  normalizeLemonCustomData,
  tierFromMetadata,
  userIdFromCustom,
} from "@/lib/lemon-webhook-utils";
import { generateLicenseKey } from "@/lib/license";
import { prisma } from "@/lib/prisma";
import { lemonWebhookMetaSchema } from "@/lib/validation";

type LemonPayload = {
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
      renews_at?: string | null;
      ends_at?: string | null;
      updated_at?: string | null;
      urls?: { customer_portal?: string | null };
      first_subscription_item?: { variant_id?: number | string };
      custom?: unknown;
    };
  };
};

function resolveExpiryDate(attrs: NonNullable<LemonPayload["data"]>["attributes"]): Date {
  const dateText = asString(attrs?.renews_at) || asString(attrs?.ends_at);
  if (dateText) {
    const parsed = new Date(dateText);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

const ACTIVE_SUBSCRIPTION_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_resumed",
  "subscription_payment_success",
]);

const CANCEL_SUBSCRIPTION_EVENTS = new Set([
  "subscription_cancelled",
  "subscription_expired",
]);

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature") ?? req.headers.get("X-Signature");

  if (!verifyLemonSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    let raw: unknown;
    try {
      raw = JSON.parse(rawBody) as unknown;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 });
    }

    const validated = lemonWebhookMetaSchema.safeParse(raw);
    if (!validated.success) {
      return NextResponse.json(validated.error.flatten(), { status: 400 });
    }

    const payload = validated.data as LemonPayload;

    const eventName = asString(payload.meta?.event_name);
    const subscriptionId = asString(payload.data?.id);
    const attrs = payload.data?.attributes || {};
    const variantId =
      String(attrs.variant_id || attrs.first_subscription_item?.variant_id || "").trim();
    const status = asString(attrs.status) || "unknown";
    const customerPortalUrl = asString(attrs.urls?.customer_portal) || null;
    const custom = normalizeLemonCustomData(
      payload.meta?.custom_data ?? attrs.custom,
    );
    const userIdFromMetadata = userIdFromCustom(custom);
    const email = asString(attrs.user_email).toLowerCase();
    const variantPlan = planByVariantId(variantId);
    const plan = tierFromMetadata(custom, variantPlan);

    // Use updated_at when available; otherwise hash event+subscription+status so Lemon retries
    // produce the same ID and don't create duplicate DB rows.
    const stableTimePart =
      asString(attrs.updated_at) ||
      `stable-${createHash("sha256").update(`${eventName}:${subscriptionId}:${status}`).digest("hex").slice(0, 16)}`;
    const lemonEventId = [eventName, subscriptionId, stableTimePart].join(":");

    if (!eventName || !subscriptionId) {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    const existingEvent = await prisma.lemonSqueezyWebhookEvent.findUnique({ where: { lemonEventId } });
    if (existingEvent) return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });

    let targetLicenseId: string | null = null;
    let targetUserId = userIdFromMetadata;
    if (!targetUserId && email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      targetUserId = user?.id || "";
    }

    const existingBySubscription = await prisma.license.findFirst({
      where: { lemonSqueezySubscriptionId: subscriptionId },
      select: { id: true, userId: true },
    });

    if (existingBySubscription) {
      targetLicenseId = existingBySubscription.id;
      if (!targetUserId) targetUserId = existingBySubscription.userId;
    }

    if (!targetLicenseId && targetUserId) {
      const existingUserLicense = await prisma.license.findFirst({
        where: { userId: targetUserId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      targetLicenseId = existingUserLicense?.id || null;
    }

    if (ACTIVE_SUBSCRIPTION_EVENTS.has(eventName)) {
      if (!targetUserId || plan === "free") {
        await prisma.lemonSqueezyWebhookEvent.create({
          data: { eventName, lemonEventId, payload: rawBody },
        });
        return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
      }

      const expiresAt = resolveExpiryDate(attrs);
      const licenseData = {
        plan,
        features: JSON.stringify(getFeatureByPlan(plan)),
        activatedAt: new Date(),
        expiresAt,
        lemonSqueezyId: subscriptionId,
        lemonSqueezySubscriptionId: subscriptionId,
        lemonSqueezyVariantId: variantId || null,
        lemonSqueezySubscriptionStatus: status,
        lemonSqueezyCustomerPortalUrl: customerPortalUrl,
      };

      const updated = targetLicenseId
        ? await prisma.license.update({
            where: { id: targetLicenseId },
            data: licenseData,
            select: { id: true },
          })
        : await prisma.license.create({
            data: {
              key: generateLicenseKey(),
              userId: targetUserId,
              ...licenseData,
            },
            select: { id: true },
          });

      await prisma.lemonSqueezyWebhookEvent.create({
        data: {
          eventName,
          lemonEventId,
          payload: rawBody,
          licenseId: updated.id,
        },
      });

      return NextResponse.json({ ok: true, plan }, { status: 200 });
    }

    if (CANCEL_SUBSCRIPTION_EVENTS.has(eventName)) {
      if (targetLicenseId) {
        await prisma.license.update({
          where: { id: targetLicenseId },
          data: {
            plan: "free",
            features: JSON.stringify(FREE_LICENSE_FEATURES),
            expiresAt: FREE_PERPETUAL_EXPIRY,
            lemonSqueezySubscriptionStatus: status === "unknown" ? "cancelled" : status,
            lemonSqueezyCustomerPortalUrl: customerPortalUrl,
          },
        });
      }
      await prisma.lemonSqueezyWebhookEvent.create({
        data: {
          eventName,
          lemonEventId,
          payload: rawBody,
          licenseId: targetLicenseId || undefined,
        },
      });
      return NextResponse.json({ ok: true, reverted: "free" }, { status: 200 });
    }

    await prisma.lemonSqueezyWebhookEvent.create({
      data: {
        eventName,
        lemonEventId,
        payload: rawBody,
        licenseId: targetLicenseId || undefined,
      },
    });
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  } catch (err) {
    console.error("[lemonsqueezy/webhook]", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
