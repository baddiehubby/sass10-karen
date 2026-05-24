import { createHmac, timingSafeEqual } from "crypto";

const API_BASE = "https://api.lemonsqueezy.com/v1";

export type LemonCheckoutTier = "pro" | "agency" | "starter" | "enterprise";
export type LemonPaidPlan = LemonCheckoutTier;

export function getLemonApiKey(): string {
  return process.env.LEMONSQUEEZY_API_KEY?.trim() || "";
}

export function getLemonStoreId(): string {
  return process.env.LEMONSQUEEZY_STORE_ID?.trim() || "";
}

function variantEnv(tier: LemonCheckoutTier): string {
  const map: Record<LemonCheckoutTier, string | undefined> = {
    pro:
      process.env.LEMONSQUEEZY_PRO_VARIANT_ID?.trim() ||
      process.env.LEMONSQUEEZY_STARTER_VARIANT_ID?.trim(),
    starter:
      process.env.LEMONSQUEEZY_STARTER_VARIANT_ID?.trim() ||
      process.env.LEMONSQUEEZY_PRO_VARIANT_ID?.trim(),
    agency: process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID?.trim(),
    enterprise: process.env.LEMONSQUEEZY_ENTERPRISE_VARIANT_ID?.trim(),
  };
  return map[tier] || "";
}

export function getLemonVariantIdByTier(tier: LemonCheckoutTier, opts?: { trial?: boolean }): string {
  const resolved: LemonCheckoutTier = tier === "starter" ? "pro" : tier;
  if (resolved === "pro" && opts?.trial) {
    const trialVariant = process.env.LEMONSQUEEZY_STARTER_TRIAL_VARIANT_ID?.trim();
    if (trialVariant) return trialVariant;
  }
  return variantEnv(resolved);
}

export function planByVariantId(variantId: string): LemonPaidPlan | "free" {
  const id = variantId.trim();
  if (!id) return "free";

  const pro =
    process.env.LEMONSQUEEZY_PRO_VARIANT_ID?.trim() ||
    process.env.LEMONSQUEEZY_STARTER_VARIANT_ID?.trim();
  const starter = process.env.LEMONSQUEEZY_STARTER_VARIANT_ID?.trim();
  const agency = process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID?.trim();
  const enterprise = process.env.LEMONSQUEEZY_ENTERPRISE_VARIANT_ID?.trim();

  if (pro && id === pro) return "pro";
  if (starter && id === starter) return "pro";
  if (agency && id === agency) return "agency";
  if (enterprise && id === enterprise) return "enterprise";
  return "free";
}

export function isActiveLemonSubscriptionStatus(status: string | null | undefined): boolean {
  const s = (status || "").trim().toLowerCase();
  return s === "active" || s === "on_trial" || s === "past_due";
}

export function verifyLemonSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;

  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const sig = signature.trim().toLowerCase();

  try {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(sig, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function lemonRequest(path: string, init?: RequestInit): Promise<Response> {
  const apiKey = getLemonApiKey();
  if (!apiKey) throw new Error("LEMONSQUEEZY_API_KEY is not configured");
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/vnd.api+json",
      ...(init?.headers || {}),
    },
  });
}
