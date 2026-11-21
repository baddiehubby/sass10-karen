import type { PaidCheckoutTier } from "@/lib/pricing-plans";
import { getAppBaseUrl, PRODUCTION_SITE_URL } from "@/lib/site-url";

export type LemonCheckoutRedirectUrls = {
  /** Lemon `product_options.redirect_url` — after successful payment. */
  successUrl: string;
  /** Stored in checkout custom data; link users back from pricing if they abandon checkout. */
  cancelUrl: string;
  /** Lemon `product_options.receipt_link_url` — receipt email CTA. */
  receiptUrl: string;
};

function assertCanonicalCheckoutUrl(url: string, base: string): string {
  let parsed: URL;
  let allowed: URL;
  try {
    parsed = new URL(url);
    allowed = new URL(base);
  } catch {
    throw new Error("Invalid Lemon checkout redirect URL");
  }
  if (parsed.origin !== allowed.origin) {
    throw new Error("Lemon checkout redirect must stay on the app origin");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Lemon checkout redirect must not include credentials");
  }
  return parsed.toString();
}

/**
 * Absolute return URLs for Lemon Squeezy checkout (never preview hosts in production).
 * Lemon only supports `redirect_url` for post-purchase; cancel is handled via our pricing page.
 * URLs are never taken from the client — open-redirect safe.
 */
export function getLemonCheckoutRedirectUrls(tier: PaidCheckoutTier): LemonCheckoutRedirectUrls {
  const base =
    process.env.NODE_ENV === "production" ? PRODUCTION_SITE_URL : getAppBaseUrl();
  const tierQ = encodeURIComponent(tier);
  const successUrl = assertCanonicalCheckoutUrl(
    `${base}/dashboard?payment=success&tier=${tierQ}`,
    base,
  );
  const cancelUrl = assertCanonicalCheckoutUrl(
    `${base}/pricing?checkout=cancelled&tier=${tierQ}`,
    base,
  );
  const receiptUrl = assertCanonicalCheckoutUrl(`${base}/dashboard/settings`, base);
  return { successUrl, cancelUrl, receiptUrl };
}

/**
 * Redirect URLs for Karen VIP ($19/mo) subscription checkout.
 * Success lands on the Accountability dashboard.
 */
export function getKarenVipCheckoutUrls(): LemonCheckoutRedirectUrls {
  const base =
    process.env.NODE_ENV === "production" ? PRODUCTION_SITE_URL : getAppBaseUrl();
  const successUrl = assertCanonicalCheckoutUrl(
    `${base}/karen/dashboard?karen=vip`,
    base,
  );
  const cancelUrl = assertCanonicalCheckoutUrl(
    `${base}/karen/result?checkout=cancelled`,
    base,
  );
  const receiptUrl = assertCanonicalCheckoutUrl(`${base}/karen/dashboard`, base);
  return { successUrl, cancelUrl, receiptUrl };
}

/** @deprecated Alias — VIP is a subscription, not a one-time unlock. */
export function getKarenUnlockCheckoutUrls(): LemonCheckoutRedirectUrls {
  return getKarenVipCheckoutUrls();
}
