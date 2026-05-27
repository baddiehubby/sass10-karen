import type { PaidCheckoutTier } from "@/lib/pricing-plans";
import { getAppBaseUrl } from "@/lib/site-url";

export type LemonCheckoutRedirectUrls = {
  /** Lemon `product_options.redirect_url` — after successful payment. */
  successUrl: string;
  /** Stored in checkout custom data; link users back from pricing if they abandon checkout. */
  cancelUrl: string;
  /** Lemon `product_options.receipt_link_url` — receipt email CTA. */
  receiptUrl: string;
};

/**
 * Absolute return URLs for Lemon Squeezy checkout (never preview hosts in production).
 * Lemon only supports `redirect_url` for post-purchase; cancel is handled via our pricing page.
 */
export function getLemonCheckoutRedirectUrls(tier: PaidCheckoutTier): LemonCheckoutRedirectUrls {
  const base = getAppBaseUrl();
  const tierQ = encodeURIComponent(tier);
  return {
    successUrl: `${base}/dashboard?payment=success&tier=${tierQ}`,
    cancelUrl: `${base}/pricing?checkout=cancelled&tier=${tierQ}`,
    receiptUrl: `${base}/dashboard/settings`,
  };
}
