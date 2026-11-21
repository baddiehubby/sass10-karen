import { NextResponse } from "next/server";

import {
  asIdString,
  asString,
  normalizeLemonCustomData,
  userIdFromCustom,
} from "@/lib/lemon-webhook-utils";
import { classifyKarenLemonEvent, isGuestLemonUserId } from "@/lib/karen/lemon-webhook-decision";
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
      first_order_item?: {
        variant_id?: number | string;
        product_id?: number | string;
      };
    };
  };
};

function resolveVariantId(
  attrs:
    | (LemonWebhookBody["data"] extends infer D
        ? D extends { attributes?: infer A }
          ? A
          : never
        : never)
    | undefined,
): string | null {
  if (!attrs) return null;
  // Lemon sends these ids as JSON numbers — asString() would silently drop them.
  const direct = asIdString((attrs as { variant_id?: unknown }).variant_id);
  if (direct) return direct;
  const item = (attrs as { first_order_item?: { variant_id?: unknown } }).first_order_item;
  return asIdString(item?.variant_id) || null;
}

/**
 * Karen VIP ($19/mo) — Lemon Squeezy webhooks.
 * subscription_* → toggles User.isPremium for the VIP variant.
 * Does not replace Buddy billing at /api/lemonsqueezy/webhook.
 *
 * Lemon dashboard → Webhooks → URL:
 *   https://<your-domain>/api/webhooks/lemonsqueezy
 * Events: subscription_created, subscription_payment_success,
 *   subscription_cancelled, subscription_expired, subscription_updated
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature") ?? req.headers.get("X-Signature");

  // Early parse so Vercel logs always show event + user for $19 payment QA.
  let earlyEventName: string | undefined;
  let earlyUserId: string | undefined;
  try {
    const early = JSON.parse(rawBody) as LemonWebhookBody;
    earlyEventName = asString(early.meta?.event_name) || undefined;
    const earlyCustom = normalizeLemonCustomData(
      early.meta?.custom_data ?? early.data?.attributes?.custom,
    );
    earlyUserId = userIdFromCustom(earlyCustom) || undefined;
  } catch {
    /* logged below if JSON is truly invalid */
  }
  console.log("WEBHOOK RECEIVED:", earlyEventName, earlyUserId);

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
  const variantId = resolveVariantId(attrs);
  const status = asString(attrs?.status).toLowerCase();
  const custom = normalizeLemonCustomData(payload.meta?.custom_data ?? attrs?.custom);
  const userId = userIdFromCustom(custom);
  const portalUrl = asString(attrs?.urls?.customer_portal) || null;
  const customerId = asIdString(attrs?.customer_id) || null;

  console.log("[karen/lemon-webhook] firing", {
    eventName,
    status: status || null,
    variantId,
    userIdPrefix: userId ? `${userId.slice(0, 8)}…` : null,
    isKarenVipVariant: isKarenVipVariant(variantId),
  });

  if (!isKarenVipVariant(variantId)) {
    console.log("[karen/lemon-webhook] ignored — not Karen unlock variant");
    return NextResponse.json({ ok: true, ignored: true, reason: "not_karen_unlock_variant" });
  }

  // Guest checkouts store a random guest_id as user_id — only update Prisma for real users.
  if (isGuestLemonUserId(userId)) {
    console.log("[karen/lemon-webhook] guest purchase — client unlocks via redirect", {
      eventName,
    });
    return NextResponse.json({ ok: true, guest: true, event: eventName });
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

  const decision = classifyKarenLemonEvent(eventName, status);

  if (decision === "activate") {
    // order_created can arrive as pending — still unlock; refunds revoke later.
    await prisma.user.update({
      where: { id: userId },
      data: {
        isPremium: true,
        ...(customerId ? { lemonSqueezyCustomerId: customerId } : {}),
        ...(portalUrl ? { karenCustomerPortalUrl: portalUrl } : {}),
      },
    });
    console.log("[karen/lemon-webhook] unlock activated", {
      eventName,
      userIdPrefix: `${userId.slice(0, 8)}…`,
    });
    return NextResponse.json({ ok: true, isPremium: true, event: eventName });
  }

  if (decision === "revoke") {
    await prisma.user.update({
      where: { id: userId },
      data: { isPremium: false },
    });
    console.log("[karen/lemon-webhook] unlock revoked", {
      eventName,
      userIdPrefix: `${userId.slice(0, 8)}…`,
    });
    return NextResponse.json({ ok: true, isPremium: false, event: eventName });
  }

  console.log("[karen/lemon-webhook] unhandled event", { eventName });
  return NextResponse.json({ ok: true, ignored: true, reason: "unhandled_event", event: eventName });
}
