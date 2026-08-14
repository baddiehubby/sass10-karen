import type { LemonWebhookPlan } from "@/lib/lemonsqueezy";

/** Lemon may send custom_data as an object or key/value array depending on API version. */
export function normalizeLemonCustomData(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (Array.isArray(raw)) {
    const out: Record<string, unknown> = {};
    for (const item of raw) {
      if (item && typeof item === "object" && "key" in item && "value" in item) {
        const row = item as { key: string; value: unknown };
        out[String(row.key)] = row.value;
      }
    }
    return out;
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

export function asString(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

export function tierFromMetadata(
  custom: Record<string, unknown> | undefined,
  variantPlan: LemonWebhookPlan | "free",
): LemonWebhookPlan | "free" {
  const tier = asString(custom?.tier).toLowerCase();
  if (tier === "free") return "free";
  if (tier === "starter") return "starter";
  if (tier === "pro") return "pro";
  if (tier === "premium") return "premium";
  if (tier === "agency") return "agency";
  if (tier === "enterprise") return "enterprise";
  return variantPlan === "free" ? "free" : variantPlan;
}

export function userIdFromCustom(custom: Record<string, unknown> | undefined): string {
  return asString(custom?.user_id);
}
