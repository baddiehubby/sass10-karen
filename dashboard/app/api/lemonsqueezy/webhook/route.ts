import { NextResponse } from "next/server";
import { getFeatureByPlan } from "@/lib/feature-plans";
import { planByVariantId, verifyLemonSignature } from "@/lib/lemonsqueezy";
import { generateLicenseKey } from "@/lib/license";
import { prisma } from "@/lib/prisma";
import { lemonWebhookMetaSchema } from "@/lib/validation";

type LemonPayload = {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
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
    };
  };
};

function asString(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function resolveExpiryDate(attrs: LemonPayload["data"] extends infer _ ? any : never): Date {
  const dateText = asString(attrs?.renews_at) || asString(attrs?.ends_at);
  if (dateText) {
    const parsed = new Date(dateText);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");
  if (!verifyLemonSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

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
  const userIdFromMetadata = asString(payload.meta?.custom_data?.user_id);
  const email = asString(attrs.user_email).toLowerCase();
  const plan = planByVariantId(variantId);

  const lemonEventId = [eventName, subscriptionId, asString(attrs.updated_at) || String(Date.now())].join(":");

  if (!eventName || !subscriptionId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const existingEvent = await prisma.lemonSqueezyWebhookEvent.findUnique({ where: { lemonEventId } });
  if (existingEvent) return NextResponse.json({ ok: true, duplicate: true });

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
      where: { userId: targetUserId, plan: { in: ["pro", "agency"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    targetLicenseId = existingUserLicense?.id || null;
  }

  if (eventName === "subscription_created" || eventName === "subscription_updated") {
    if (!targetUserId || plan === "free") {
      await prisma.lemonSqueezyWebhookEvent.create({
        data: {
          eventName,
          lemonEventId,
          payload: rawBody,
        },
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    const expiresAt = resolveExpiryDate(attrs);
    const updated = targetLicenseId
      ? await prisma.license.update({
          where: { id: targetLicenseId },
          data: {
            plan,
            features: JSON.stringify(getFeatureByPlan(plan)),
            activatedAt: new Date(),
            expiresAt,
            lemonSqueezyId: subscriptionId,
            lemonSqueezySubscriptionId: subscriptionId,
            lemonSqueezyVariantId: variantId || null,
            lemonSqueezySubscriptionStatus: status,
            lemonSqueezyCustomerPortalUrl: customerPortalUrl,
          },
          select: { id: true },
        })
      : await prisma.license.create({
          data: {
            key: generateLicenseKey(),
            userId: targetUserId,
            plan,
            features: JSON.stringify(getFeatureByPlan(plan)),
            expiresAt,
            activatedAt: new Date(),
            lemonSqueezyId: subscriptionId,
            lemonSqueezySubscriptionId: subscriptionId,
            lemonSqueezyVariantId: variantId || null,
            lemonSqueezySubscriptionStatus: status,
            lemonSqueezyCustomerPortalUrl: customerPortalUrl,
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

    return NextResponse.json({ ok: true });
  }

  if (eventName === "subscription_cancelled") {
    if (targetLicenseId) {
      await prisma.license.update({
        where: { id: targetLicenseId },
        data: {
          plan: "free",
          features: JSON.stringify(getFeatureByPlan("free")),
          expiresAt: new Date(),
          lemonSqueezySubscriptionStatus: "cancelled",
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
    return NextResponse.json({ ok: true });
  }

  await prisma.lemonSqueezyWebhookEvent.create({
    data: {
      eventName,
      lemonEventId,
      payload: rawBody,
      licenseId: targetLicenseId || undefined,
    },
  });
  return NextResponse.json({ ok: true, ignored: true });
}
