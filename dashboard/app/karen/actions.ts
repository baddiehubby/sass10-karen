"use server";

import { getLemonCheckoutRedirectUrls } from "@/lib/lemon-checkout-urls";
import { getKarenVipVariantId } from "@/lib/karen/vip";
import { lemonRequest, resolveLemonStoreId } from "@/lib/lemonsqueezy";
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/session-user";

export type KarenVipCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export type KarenVipPortalResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Create a Lemon Squeezy checkout URL for Karen VIP ($19/mo variant).
 */
export async function createKarenVipCheckout(): Promise<KarenVipCheckoutResult> {
  const userId = await sessionUserId();
  if (!userId) return { ok: false, error: "Sign in to upgrade to Karen VIP." };

  const variantId = getKarenVipVariantId();
  const storeId = await resolveLemonStoreId();
  if (!variantId || !storeId) {
    return {
      ok: false,
      error:
        "Karen VIP checkout is not configured (set LEMONSQUEEZY_KAREN_VIP_VARIANT_ID and store credentials).",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  const urls = getLemonCheckoutRedirectUrls("premium");

  try {
    const response = await lemonRequest("/checkouts", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: {
              email: user?.email || undefined,
              name: user?.name || undefined,
              custom: {
                user_id: userId,
                product: "karen_vip",
                cancel_return_url: `${urls.cancelUrl}&product=karen_vip`,
              },
            },
            product_options: {
              redirect_url: `${urls.successUrl}${urls.successUrl.includes("?") ? "&" : "?"}karen=vip`,
              receipt_button_text: "Open Karen",
            },
          },
          relationships: {
            store: { data: { type: "stores", id: storeId } },
            variant: { data: { type: "variants", id: variantId } },
          },
        },
      }),
    });

    const payload = (await response.json()) as {
      data?: { attributes?: { url?: string } };
      errors?: Array<{ detail?: string }>;
    };

    if (!response.ok) {
      return {
        ok: false,
        error: payload.errors?.[0]?.detail || "Lemon Squeezy checkout failed.",
      };
    }

    const url = payload.data?.attributes?.url?.trim();
    if (!url) return { ok: false, error: "Checkout URL missing from Lemon Squeezy." };
    return { ok: true, url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Checkout failed";
    return { ok: false, error: msg };
  }
}

/** Resolve Lemon customer portal URL for the signed-in user. */
export async function getKarenVipPortalUrl(): Promise<KarenVipPortalResult> {
  const userId = await sessionUserId();
  if (!userId) return { ok: false, error: "Sign in to manage your subscription." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPremium: true,
      karenCustomerPortalUrl: true,
      licenses: {
        where: { lemonSqueezyCustomerPortalUrl: { not: null } },
        select: { lemonSqueezyCustomerPortalUrl: true },
        take: 1,
        orderBy: { updatedAt: "desc" },
      },
      subscriptions: {
        where: { customerPortalUrl: { not: null } },
        select: { customerPortalUrl: true },
        take: 1,
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  const url =
    user?.karenCustomerPortalUrl?.trim() ||
    user?.subscriptions[0]?.customerPortalUrl?.trim() ||
    user?.licenses[0]?.lemonSqueezyCustomerPortalUrl?.trim() ||
    "";

  if (!url) {
    return {
      ok: false,
      error: user?.isPremium
        ? "Portal link not ready yet — check your Lemon Squeezy email receipt."
        : "No active Karen VIP subscription found.",
    };
  }

  return { ok: true, url };
}
