import { NextResponse } from "next/server";

import { asString, normalizeLemonCustomData, userIdFromCustom } from "@/lib/lemon-webhook-utils";
import { isKarenVipVariant } from "@/lib/karen/vip";
import { verifyLemonSignature } from "@/lib/lemonsqueezy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LemonWebhookBody = {
  meta?: {
    event_name?: string;
    custom_data?: unknown;
  };
  data?: {
    attributes?: {
      status?: string;
      variant_id?: number | string;
      customer_id?: number | string;
      urls?: { customer_portal?: string | null };
      custom?: unknown;
    };
  };
};

/**
 * Karen VIP Lemon Squeezy webhooks.
 * Verifies HMAC signature, then toggles User.isPremium for VIP variant events.
 * Does not replace the Buddy billing webhook at /api/lemonsqueezy/webhook.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature") ?? req.headers.get("X-Signature");

  if (!verifyLemonSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: LemonWebhookBody;
  try {
    payload = JSON.parse(rawBody) as LemonWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = asString(payload.meta?.event_name).toLowerCase();
  const attrs = payload.data?.attributes;
  const variantId = attrs?.variant_id;
  const custom = normalizeLemonCustomData(payload.meta?.custom_data ?? attrs?.custom);
  const userId = userIdFromCustom(custom);
  const portalUrl = asString(attrs?.urls?.customer_portal) || null;
  const customerId = asString(attrs?.customer_id) || null;

  if (!isKarenVipVariant(variantId)) {
    return NextResponse.json({ ok: true, ignored: true, reason: "not_karen_vip_variant" });
  }

  if (!userId || userId.length < 8) {
    return NextResponse.json({ ok: true, ignored: true, reason: "missing_user_id" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ ok: true, ignored: true, reason: "unknown_user" });
  }

  if (eventName === "subscription_created" || eventName === "subscription_resumed") {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isPremium: true,
        ...(customerId ? { lemonSqueezyCustomerId: customerId } : {}),
        ...(portalUrl ? { karenCustomerPortalUrl: portalUrl } : {}),
      },
    });
    return NextResponse.json({ ok: true, isPremium: true, event: eventName });
  }

  if (
    eventName === "subscription_cancelled" ||
    eventName === "subscription_expired" ||
    eventName === "subscription_payment_failed"
  ) {
    await prisma.user.update({
      where: { id: userId },
      data: { isPremium: false },
    });
    return NextResponse.json({ ok: true, isPremium: false, event: eventName });
  }

  if (eventName === "subscription_updated") {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(customerId ? { lemonSqueezyCustomerId: customerId } : {}),
        ...(portalUrl ? { karenCustomerPortalUrl: portalUrl } : {}),
      },
    });
  }

  return NextResponse.json({ ok: true, ignored: true, reason: "unhandled_event", event: eventName });
}
