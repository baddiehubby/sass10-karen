import { NextResponse } from "next/server";
import { createPrismaBillingStore } from "@/lib/billing/prisma-store";
import { parseLemonWebhookPayload, type LemonWebhookJson } from "@/lib/billing/parse-webhook";
import { processParsedWebhook } from "@/lib/billing/processor";
import { verifyLemonSignature } from "@/lib/lemonsqueezy";
import { lemonWebhookMetaSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Lemon Squeezy webhooks — signature verified, idempotent, entitlement via Subscription.
 * Never trusts client checkout success or query flags.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature") ?? req.headers.get("X-Signature");

  if (!verifyLemonSignature(rawBody, signature)) {
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
      return NextResponse.json({ ok: true, ignored: true, reason: "incomplete_payload" }, { status: 200 });
    }

    const result = await processParsedWebhook(createPrismaBillingStore(), parsed);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    // Never log secrets, API keys, or payment payloads
    console.error("[lemonsqueezy/webhook] handler failed");
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
