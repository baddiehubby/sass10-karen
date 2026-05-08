import { createHmac } from "crypto";

const API_BASE = "https://api.lemonsqueezy.com/v1";

export function getLemonApiKey(): string {
  return process.env.LEMONSQUEEZY_API_KEY?.trim() || "";
}

export function getLemonStoreId(): string {
  return process.env.LEMONSQUEEZY_STORE_ID?.trim() || "";
}

export function getLemonVariantIdByTier(tier: "pro" | "agency"): string {
  return tier === "pro"
    ? process.env.LEMONSQUEEZY_PRO_VARIANT_ID?.trim() || ""
    : process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID?.trim() || "";
}

export function planByVariantId(variantId: string): "pro" | "agency" | "free" {
  const pro = process.env.LEMONSQUEEZY_PRO_VARIANT_ID?.trim();
  const agency = process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID?.trim();
  if (variantId && pro && variantId === pro) return "pro";
  if (variantId && agency && variantId === agency) return "agency";
  return "free";
}

export function verifyLemonSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return digest === signature;
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
