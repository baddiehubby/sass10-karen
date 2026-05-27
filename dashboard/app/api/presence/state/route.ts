import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { BuddyMood } from "@/lib/mood-detection";
import { applyMoodUpdate, createDefaultPresenceState, normalizePresenceState } from "@/lib/presence-state";
import { assertLicenseAccess, getPresenceForLicense, upsertPresenceState } from "@/lib/presence-service";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  licenseKey: z.string().min(8),
  currentMood: z
    .enum(["neutral", "happy", "thinking", "concerned", "excited", "sleepy"])
    .optional(),
  guidanceText: z.string().max(280).optional(),
  companionName: z.string().max(64).optional(),
  lastCheckIn: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  const licenseKey = req.nextUrl.searchParams.get("licenseKey")?.trim() || "";
  if (!licenseKey) {
    return NextResponse.json({ error: "licenseKey required" }, { status: 400 });
  }

  const access = await assertLicenseAccess(req, licenseKey, { readOnly: true });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const state = await getPresenceForLicense(licenseKey);
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { licenseKey, currentMood, guidanceText, companionName } = parsed.data;
  const access = await assertLicenseAccess(req, licenseKey);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let state =
    (await getPresenceForLicense(licenseKey)) ??
    createDefaultPresenceState(licenseKey, companionName || "Buddy");

  if (companionName) {
    state = { ...state, companionName };
  }

  if (currentMood) {
    state = applyMoodUpdate(state, currentMood as BuddyMood, guidanceText ? { guidanceText } : undefined);
  } else if (guidanceText) {
    state = applyMoodUpdate(state, state.currentMood, { guidanceText });
  }

  const saved = await upsertPresenceState(normalizePresenceState(state));
  return NextResponse.json({ ok: true, ...saved });
}
