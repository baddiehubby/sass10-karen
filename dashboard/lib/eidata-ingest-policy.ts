import { hasConsent } from "@/lib/consent-service";

export const WIDGET_OPT_IN_HEADER = "x-buddy-widget-opt-in";

export function widgetOptInFromRequest(req: Request): boolean {
  return req.headers.get(WIDGET_OPT_IN_HEADER)?.trim().toLowerCase() === "yes";
}

/**
 * GDPR / SB 243 / China 2026: account holders need server-side consent;
 * extension/widget-only users may ingest with explicit widget opt-in header only.
 */
export async function canIngestAnonymizedEvent(opts: {
  userId: string | null;
  widgetOptIn: boolean;
}): Promise<{ allowed: boolean; reason?: string }> {
  if (opts.userId) {
    const [analytics, training] = await Promise.all([
      hasConsent(opts.userId, "anonymous_analytics"),
      hasConsent(opts.userId, "model_training"),
    ]);
    if (analytics || training) return { allowed: true };
    return { allowed: false, reason: "consent_denied" };
  }

  if (opts.widgetOptIn) return { allowed: true };
  return { allowed: false, reason: "widget_opt_in_required" };
}

/** Enterprise licensing requires separate data_selling consent (checked at export time). */
export async function canExportForDataLicensing(userId: string): Promise<boolean> {
  return hasConsent(userId, "data_selling");
}
