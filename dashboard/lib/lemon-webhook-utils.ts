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

/**
 * Resolve paid plan from Lemon variant id only.
 * Custom metadata tier is advisory and must never upgrade above the variant.
 */
export function tierFromMetadata(
  custom: Record<string, unknown> | undefined,
  variantPlan: LemonWebhookPlan | "free",
): LemonWebhookPlan | "free" {
  if (variantPlan !== "free") return variantPlan;

  // Variant unknown/unmapped — refuse to invent a paid tier from client custom data.
  void custom;
  return "free";
}

export function userIdFromCustom(custom: Record<string, unknown> | undefined): string {
  return asString(custom?.user_id);
}
