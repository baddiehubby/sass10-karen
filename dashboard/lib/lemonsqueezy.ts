import { createHmac, timingSafeEqual } from "crypto";
import type { PaidCheckoutTier } from "@/lib/pricing-plans";

const API_BASE = "https://api.lemonsqueezy.com/v1";

/** Tiers that open Lemon Squeezy checkout (paid products only). */
export type LemonCheckoutTier = PaidCheckoutTier;

/** Plans resolved from Lemon webhooks (includes legacy variant IDs). */
export type LemonWebhookPlan = LemonCheckoutTier | "starter" | "enterprise";

export function getLemonApiKey(): string {
  return process.env.LEMONSQUEEZY_API_KEY?.trim() || "";
}

export function getLemonStoreId(): string {
  return process.env.LEMONSQUEEZY_STORE_ID?.trim() || "";
}

/** In-process cache when store ID is resolved via API (single-store accounts). */
let cachedStoreIdFromApi: string | null = null;

/**
 * Store ID for checkout creation. Uses LEMONSQUEEZY_STORE_ID when set; otherwise
 * fetches GET /v1/stores and uses the first store (requires LEMONSQUEEZY_API_KEY).
 */
export async function resolveLemonStoreId(): Promise<string> {
  const fromEnv = getLemonStoreId();
  if (fromEnv) return fromEnv;

  if (cachedStoreIdFromApi) return cachedStoreIdFromApi;
  if (!getLemonApiKey()) return "";

  try {
    const response = await lemonRequest("/stores");
    const payload = (await response.json()) as {
      data?: Array<{ id: string }>;
      errors?: Array<{ detail?: string }>;
    };

    if (!response.ok) {
      console.error("[lemonsqueezy] list stores:", payload.errors?.[0]?.detail || response.status);
      return "";
    }

    const id = payload.data?.[0]?.id?.trim() || "";
    if (id) cachedStoreIdFromApi = id;
    return id;
  } catch (err) {
    console.error("[lemonsqueezy] resolve store id", err);
    return "";
  }
}

function variantIdForCheckoutTier(tier: LemonCheckoutTier): string {
  if (tier === "pro") {
    return process.env.LEMONSQUEEZY_PRO_VARIANT_ID?.trim() || "";
  }
  return process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID?.trim() || "";
}

export function getLemonVariantIdByTier(tier: LemonCheckoutTier, opts?: { trial?: boolean }): string {
  if (tier === "pro" && opts?.trial) {
    const trialVariant = process.env.LEMONSQUEEZY_PRO_TRIAL_VARIANT_ID?.trim();
    if (trialVariant) return trialVariant;
  }
  return variantIdForCheckoutTier(tier);
}

/** Map Lemon variant IDs to app license plans (webhooks / legacy products). */
export function planByVariantId(variantId: string): LemonWebhookPlan | "free" {
  const id = variantId.trim();
  if (!id) return "free";

  const pro = process.env.LEMONSQUEEZY_PRO_VARIANT_ID?.trim();
  const agency = process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID?.trim();
  /** Legacy Lemon "Starter" product — treated as Pro in the app. */
  const starter = process.env.LEMONSQUEEZY_STARTER_VARIANT_ID?.trim();
  const enterprise = process.env.LEMONSQUEEZY_ENTERPRISE_VARIANT_ID?.trim();

  if (pro && id === pro) return "pro";
  if (agency && id === agency) return "agency";
  if (starter && id === starter) return "pro";
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
  const sig = signature.trim().toLowerCase().replace(/^sha256=/, "");

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
