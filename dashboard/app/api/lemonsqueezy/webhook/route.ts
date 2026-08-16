import { NextResponse } from "next/server";
import { createPrismaBillingStore } from "@/lib/billing/prisma-store";
import { parseLemonWebhookPayload, type LemonWebhookJson } from "@/lib/billing/parse-webhook";
import { processParsedWebhook } from "@/lib/billing/processor";
import { httpStatusForLemonWebhookResult } from "@/lib/billing/webhook-http";
import { verifyLemonSignature } from "@/lib/lemonsqueezy";
import { logBillingAudit, logStructured, safeErrorMessage } from "@/lib/ops/logger";
import { getRequestIdFromRequest } from "@/lib/ops/request-id";
import { observeApiRoute } from "@/lib/ops/api-telemetry";
import { lemonWebhookMetaSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Lemon Squeezy webhooks — signature verified, idempotent, entitlement via Subscription.
 * Never trusts client checkout success or query flags.
 * Never logs payloads, signatures, or payment secrets.
 */
export async function POST(req: Request) {
  return observeApiRoute(req, "/api/lemonsqueezy/webhook", async () => {
    const requestId = getRequestIdFromRequest(req);
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") ?? req.headers.get("X-Signature");

    if (!verifyLemonSignature(rawBody, signature)) {
      logStructured({
        level: "warn",
        msg: "webhook signature rejected",
        event: "billing.webhook",
        requestId,
        route: "/api/lemonsqueezy/webhook",
        outcome: "invalid_signature",
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    try {
      let raw: unknown;
      try {
        raw = JSON.parse(rawBody) as unknown;
      } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }

      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 });
      }

      const validated = lemonWebhookMetaSchema.safeParse(raw);
      if (!validated.success) {
        return NextResponse.json(validated.error.flatten(), { status: 400 });
      }

      const parsed = parseLemonWebhookPayload(rawBody, validated.data as LemonWebhookJson);
      if (!parsed) {
        logBillingAudit({
          requestId,
          lemonEventId: "incomplete",
          eventName: "unknown",
          action: "ignore",
          outcome: "incomplete_payload",
        });
        return NextResponse.json({ ok: true, ignored: true, reason: "incomplete_payload" }, { status: 200 });
      }

      const result = await processParsedWebhook(createPrismaBillingStore(), parsed);
      const outcome =
        "duplicate" in result && result.duplicate
          ? "duplicate"
          : "ignored" in result && result.ignored
            ? String(result.reason || "ignored")
            : "stale" in result && result.stale
              ? "stale"
              : "ok" in result && result.ok === false
                ? "error"
                : "applied";
      logBillingAudit({
        requestId,
        lemonEventId: parsed.eventId,
        eventName: parsed.eventName,
        action: outcome === "applied" ? "apply" : outcome === "duplicate" ? "duplicate" : "ignore",
        outcome,
      });
      return NextResponse.json(result, { status: httpStatusForLemonWebhookResult(result) });
    } catch (err) {
      logStructured({
        level: "error",
        msg: "webhook handler failed",
        event: "billing.webhook",
        requestId,
        route: "/api/lemonsqueezy/webhook",
        errorCode: safeErrorMessage(err),
        outcome: "handler_failed",
      });
      return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
    }
  });
}
