import type { WebhookProcessResult } from "@/lib/billing/types";

/** Reasons where claim was released — Lemon must retry (non-2xx). */
export const LEMON_RETRY_WEBHOOK_REASONS = new Set([
  "unknown_user",
  "unknown_variant",
  "missing_subscription_id",
  "nothing_to_cancel",
]);

/**
 * Map processor result → HTTP status for Lemon delivery.
 * Applied / duplicate / stale / intentional ignores → 200.
 * Retryable ignores (claim released) → 503 so Lemon redelivers.
 */
export function httpStatusForLemonWebhookResult(result: WebhookProcessResult): number {
  if (!result.ok) return result.httpStatus || 500;
  if ("ignored" in result && result.ignored && LEMON_RETRY_WEBHOOK_REASONS.has(String(result.reason))) {
    return 503;
  }
  return 200;
}
