import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { parseJsonBody } from "@/lib/api-json";
import { CONSENT_PURPOSES, isConsentPurpose, isConsentStatus } from "@/lib/consent-purposes";
import {
  getUserConsents,
  markEidataConsentCompleted,
  setUserConsentsBulk,
  withdrawUserConsent,
} from "@/lib/consent-service";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  consents: z.array(
    z.object({
      purpose: z.string().refine(isConsentPurpose, "Invalid purpose"),
      status: z.string().refine(isConsentStatus, "Invalid status"),
    }),
  ),
  complete: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const consents = await getUserConsents(session.user.id);
  return NextResponse.json({ ok: true, consents, purposes: CONSENT_PURPOSES });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody(req, updateSchema);
  if (!parsed.ok) return parsed.response;

  const updates = parsed.data.consents.map((c) => ({
    purpose: c.purpose,
    status: c.status,
  }));

  const consents = await setUserConsentsBulk(session.user.id, updates);

  if (parsed.data.complete) {
    try {
      await markEidataConsentCompleted(session.user.id);
    } catch (err) {
      // #region agent log
      fetch("http://127.0.0.1:7611/ingest/87ee683e-41c7-4485-9b1b-9c00188d4aac", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f590a1" },
        body: JSON.stringify({
          sessionId: "f590a1",
          hypothesisId: "F",
          location: "consent/route.ts:mark-complete",
          message: "markEidataConsentCompleted failed",
          data: { error: err instanceof Error ? err.message : "unknown" },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      throw err;
    }
  }

  // #region agent log
  fetch("http://127.0.0.1:7611/ingest/87ee683e-41c7-4485-9b1b-9c00188d4aac", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f590a1" },
    body: JSON.stringify({
      sessionId: "f590a1",
      hypothesisId: "F",
      location: "consent/route.ts:success",
      message: "consent saved",
      data: { complete: Boolean(parsed.data.complete), consentCount: consents.length },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return NextResponse.json({ ok: true, consents });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const purpose = req.nextUrl.searchParams.get("purpose")?.trim() || "";
  if (!isConsentPurpose(purpose)) {
    return NextResponse.json({ error: "Invalid purpose query param" }, { status: 400 });
  }

  const record = await withdrawUserConsent(session.user.id, purpose);
  return NextResponse.json({ ok: true, consent: record });
}
