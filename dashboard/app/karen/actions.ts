"use server";

import {
  sanitizeAccountabilityState,
  type AccountabilityState,
} from "@/lib/karen/accountability";
import {
  accountabilitySyncFailure,
  classifyAccountabilitySyncError,
  type AccountabilitySyncResult,
} from "@/lib/karen/accountability-sync";
import { getKarenVipCheckoutUrls } from "@/lib/lemon-checkout-urls";
import { getKarenVipVariantId, isDevVipMode } from "@/lib/karen/vip";
import { lemonRequest, resolveLemonStoreId } from "@/lib/lemonsqueezy";
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/session-user";

export type KarenVipCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string; needsAuth?: boolean };

export type KarenVipPortalResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export type CreateKarenVipCheckoutInput = {
  /** Optional guest id — VIP subscription still requires a signed-in user. */
  guestId?: string | null;
};

/**
 * Create a Lemon Squeezy checkout for Karen VIP / Savage Protocol.
 * Faith Shatter CTA frames this as $20/mo — keep the Lemon variant aligned.
 * Requires sign-in so webhooks can set `user.isPremium`.
 */
export async function createKarenVipCheckout(
  _input: CreateKarenVipCheckoutInput = {},
): Promise<KarenVipCheckoutResult> {
  const userId = await sessionUserId();
  if (!userId) {
    return {
      ok: false,
      needsAuth: true,
      error: "Sign in to subscribe to Karen VIP.",
    };
  }

  const variantId = getKarenVipVariantId();
  const storeId = await resolveLemonStoreId();
  if (!variantId || !storeId) {
    const missing = [
      !variantId ? "LEMONSQUEEZY_KAREN_VIP_VARIANT_ID" : null,
      !storeId ? "LEMONSQUEEZY_STORE_ID (and LEMONSQUEEZY_API_KEY)" : null,
    ].filter(Boolean);
    return {
      ok: false,
      error: `Karen VIP checkout is not configured — missing: ${missing.join(", ")}.`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  const urls = getKarenVipCheckoutUrls();

  try {
    const response = await lemonRequest("/checkouts", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_options: {
              embed: false,
              media: false,
              logo: true,
            },
            checkout_data: {
              email: user?.email || undefined,
              name: user?.name || undefined,
              custom: {
                user_id: userId,
                product: "karen_vip",
                purchase_type: "subscription",
                cancel_return_url: `${urls.cancelUrl}&product=karen_vip`,
              },
            },
            product_options: {
              redirect_url: `${urls.successUrl}${urls.successUrl.includes("?") ? "&" : "?"}subscribed=1`,
              receipt_button_text: "Open Karen VIP",
              receipt_link_url: urls.receiptUrl,
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

/** @deprecated Alias — VIP is the $19/mo subscription. */
export async function createKarenUnlockCheckout(
  input: CreateKarenVipCheckoutInput = {},
): Promise<KarenVipCheckoutResult> {
  return createKarenVipCheckout(input);
}

/** Resolve Lemon customer portal URL for the signed-in user (receipts / refunds). */
export async function getKarenVipPortalUrl(): Promise<KarenVipPortalResult> {
  const userId = await sessionUserId();
  if (!userId) return { ok: false, error: "Sign in to manage your purchase." };

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
        : "No Karen unlock purchase found.",
    };
  }

  return { ok: true, url };
}

export type SaveAccountabilityResult = AccountabilitySyncResult;

/**
 * Persist Accountability Loop goals to Prisma (`User.karenAccountabilityJson`)
 * for signed-in users. localStorage stays the offline cache + evening-timer
 * source; this makes the account the durable copy.
 *
 * Input is untrusted (server actions are callable directly) → always sanitized.
 * Failures are logged here and returned as a safe, typed reason — never the raw
 * Prisma message (can contain hosts / connection details).
 */
export async function saveKarenAccountabilityState(
  state: AccountabilityState,
): Promise<SaveAccountabilityResult> {
  const userId = await sessionUserId();
  if (!userId) return accountabilitySyncFailure("unknown"); // guests never reach this

  const clean = sanitizeAccountabilityState(state);
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { karenAccountabilityJson: JSON.stringify(clean) },
      select: { id: true },
    });
    return { ok: true };
  } catch (err) {
    const reason = classifyAccountabilitySyncError(err);
    console.warn(
      `[karen/accountability] save failed (${reason})`,
      err instanceof Error ? err.message : err,
    );
    return accountabilitySyncFailure(reason);
  }
}

export type KarenDevBillingStatus = {
  signedIn: boolean;
  /** Last 4 chars only — enough to eyeball which account is under test. */
  userIdTail: string | null;
  /** Live Prisma `User.isPremium`; null when signed out or the DB is unreachable. */
  isPremiumDb: boolean | null;
  dbError: string | null;
  /** True when the dev VIP bypass is hiding the paywall. */
  paywallBypassed: boolean;
  /** Presence flags only — values are never returned. */
  config: { apiKey: boolean; storeId: boolean; vipVariant: boolean; webhookSecret: boolean };
};

/**
 * DEV ONLY (QA): live billing snapshot for the "Test VIP Checkout" tool.
 * Returns null anywhere except `next dev` so it can never leak in production.
 */
export async function getKarenDevBillingStatus(): Promise<KarenDevBillingStatus | null> {
  if (process.env.NODE_ENV !== "development") return null;

  const config = {
    apiKey: Boolean(process.env.LEMONSQUEEZY_API_KEY?.trim()),
    storeId: Boolean(process.env.LEMONSQUEEZY_STORE_ID?.trim()),
    vipVariant: Boolean(getKarenVipVariantId()),
    webhookSecret: Boolean(process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim()),
  };
  const paywallBypassed = isDevVipMode();

  const userId = await sessionUserId();
  if (!userId) {
    return {
      signedIn: false,
      userIdTail: null,
      isPremiumDb: null,
      dbError: null,
      paywallBypassed,
      config,
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPremium: true },
    });
    return {
      signedIn: true,
      userIdTail: userId.slice(-4),
      isPremiumDb: user ? Boolean(user.isPremium) : null,
      dbError: user ? null : "Session user has no row in the database.",
      paywallBypassed,
      config,
    };
  } catch (err) {
    return {
      signedIn: true,
      userIdTail: userId.slice(-4),
      isPremiumDb: null,
      dbError: err instanceof Error ? err.message.split("\n").pop() ?? "DB error" : "DB error",
      paywallBypassed,
      config,
    };
  }
}

export async function loadKarenAccountabilityState(): Promise<AccountabilityState | null> {
  const userId = await sessionUserId();
  if (!userId) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { karenAccountabilityJson: true },
    });
    if (!user?.karenAccountabilityJson) return null;
    return sanitizeAccountabilityState(JSON.parse(user.karenAccountabilityJson));
  } catch (err) {
    console.warn(
      `[karen/accountability] load failed (${classifyAccountabilitySyncError(err)})`,
    );
    return null;
  }
}
