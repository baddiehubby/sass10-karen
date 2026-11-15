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
    id?: string;
    attributes?: {
      status?: string;
      variant_id?: number | string;
      product_id?: number | string;
      customer_id?: number | string;
      urls?: { customer_portal?: string | null };
      custom?: unknown;
      renews_at?: string | null;
      ends_at?: string | null;
    };
  };
};

const ACTIVATE_EVENTS = new Set([
  "subscription_created",
  "subscription_resumed",
  "subscription_unpaused",
  "subscription_payment_success",
]);

const REVOKE_EVENTS = new Set([
  "subscription_cancelled",
  "subscription_expired",
  "subscription_payment_failed",
  "subscription_paused",
]);

/**
 * Karen VIP Lemon Squeezy webhooks.
 * Verifies HMAC signature, then toggles User.isPremium for VIP variant events.
 * Does not replace the Buddy billing webhook at /api/lemonsqueezy/webhook.
 *
 * Lemon dashboard → Webhooks → URL:
 *   https://<your-domain>/api/webhooks/lemonsqueezy
 * Events: subscription_created, subscription_cancelled, subscription_expired
 * (+ payment_success / resumed recommended).
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature") ?? req.headers.get("X-Signature");

  // Verify purchase webhook is reaching us (safe — no secrets / full payload).
  console.log("[karen/lemon-webhook] request received", {
    hasSignature: Boolean(signature),
    bodyBytes: rawBody.length,
  });

  if (!verifyLemonSignature(rawBody, signature)) {
    console.warn("[karen/lemon-webhook] invalid signature — rejected");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: LemonWebhookBody;
  try {
    payload = JSON.parse(rawBody) as LemonWebhookBody;
  } catch {
    console.warn("[karen/lemon-webhook] invalid JSON");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = asString(payload.meta?.event_name).toLowerCase();
  const attrs = payload.data?.attributes;
  const variantId = attrs?.variant_id;
  const status = asString(attrs?.status).toLowerCase();
  const custom = normalizeLemonCustomData(payload.meta?.custom_data ?? attrs?.custom);
  const userId = userIdFromCustom(custom);
  const portalUrl = asString(attrs?.urls?.customer_portal) || null;
  const customerId = asString(attrs?.customer_id) || null;
  const subscriptionId = asString(payload.data?.id) || null;

  console.log("[karen/lemon-webhook] firing", {
    eventName,
    status: status || null,
    variantId: variantId != null ? String(variantId) : null,
    subscriptionId,
    userIdPrefix: userId ? `${userId.slice(0, 8)}…` : null,
    isKarenVipVariant: isKarenVipVariant(variantId),
  });

  if (!isKarenVipVariant(variantId)) {
    console.log("[karen/lemon-webhook] ignored — not Karen VIP variant");
    return NextResponse.json({ ok: true, ignored: true, reason: "not_karen_vip_variant" });
  }

  if (!userId || userId.length < 8) {
    console.warn("[karen/lemon-webhook] ignored — missing custom_data.user_id");
    return NextResponse.json({ ok: true, ignored: true, reason: "missing_user_id" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    console.warn("[karen/lemon-webhook] ignored — unknown user", {
      userIdPrefix: `${userId.slice(0, 8)}…`,
    });
    return NextResponse.json({ ok: true, ignored: true, reason: "unknown_user" });
  }

  // Activate VIP
  if (ACTIVATE_EVENTS.has(eventName)) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isPremium: true,
        ...(customerId ? { lemonSqueezyCustomerId: customerId } : {}),
        ...(portalUrl ? { karenCustomerPortalUrl: portalUrl } : {}),
      },
    });
    console.log("[karen/lemon-webhook] VIP activated", {
      eventName,
      userIdPrefix: `${userId.slice(0, 8)}…`,
    });
    return NextResponse.json({ ok: true, isPremium: true, event: eventName });
  }

  // Revoke VIP — cancelled / expired / payment failed / paused
  if (REVOKE_EVENTS.has(eventName)) {
    await prisma.user.update({
      where: { id: userId },
      data: { isPremium: false },
    });
    console.log("[karen/lemon-webhook] VIP revoked", {
      eventName,
      userIdPrefix: `${userId.slice(0, 8)}…`,
    });
    return NextResponse.json({ ok: true, isPremium: false, event: eventName });
  }

  // Keep portal / customer ids fresh on updates without flipping entitlement
  // unless status clearly says the sub is dead.
  if (eventName === "subscription_updated") {
    const dead =
      status === "expired" ||
      status === "cancelled" ||
      status === "unpaid" ||
      status === "paused";
    const active =
      status === "active" || status === "on_trial" || status === "paid";

    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(dead ? { isPremium: false } : {}),
        ...(active ? { isPremium: true } : {}),
        ...(customerId ? { lemonSqueezyCustomerId: customerId } : {}),
        ...(portalUrl ? { karenCustomerPortalUrl: portalUrl } : {}),
      },
    });
    console.log("[karen/lemon-webhook] subscription_updated applied", {
      status: status || null,
      isPremium: dead ? false : active ? true : "unchanged",
      userIdPrefix: `${userId.slice(0, 8)}…`,
    });
    return NextResponse.json({
      ok: true,
      event: eventName,
      isPremium: dead ? false : active ? true : undefined,
    });
  }

  console.log("[karen/lemon-webhook] unhandled event", { eventName });
  return NextResponse.json({ ok: true, ignored: true, reason: "unhandled_event", event: eventName });
}
