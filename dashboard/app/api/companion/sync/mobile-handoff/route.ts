import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/lib/api-json";
import { getUserEntitlement } from "@/lib/billing/entitlement";
import { buildCompanionSyncPayload } from "@/lib/companion-sync";
import {
  base64UrlSha256,
  issueMobileHandoff,
  validateBridgeState,
  validateCodeChallenge,
  validateDevicePublicKey,
  validateRequestOrigin,
} from "@/lib/mobile-auth";
import {
  persistMobileAuthorizationCode,
  registerMobileDevice,
} from "@/lib/mobile-auth-store";
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/session-user";
import { getCanonicalSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    codeChallenge: z.string().min(43).max(43),
    state: z.string().min(32).max(128),
    devicePublicKey: z.string().min(80).max(256),
    platform: z.enum(["android", "ios"]).optional(),
    deviceName: z.string().trim().min(1).max(64).optional(),
    appVersion: z.string().trim().min(1).max(32).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!validateCodeChallenge(value.codeChallenge)) {
      ctx.addIssue({ code: "custom", path: ["codeChallenge"], message: "Invalid code challenge" });
    }
    if (!validateBridgeState(value.state)) {
      ctx.addIssue({ code: "custom", path: ["state"], message: "Invalid state" });
    }
    if (!validateDevicePublicKey(value.devicePublicKey)) {
      ctx.addIssue({ code: "custom", path: ["devicePublicKey"], message: "Invalid device key" });
    }
  });

export async function POST(req: Request) {
  // This session-authenticated endpoint is called only by our connect page.
  // Requiring the canonical Origin prevents cross-site form/fetch issuance.
  const origin = req.headers.get("origin");
  if (!validateRequestOrigin(origin, getCanonicalSiteUrl())) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody(req, requestSchema);
  if (!parsed.ok) return parsed.response;

  const entitlement = await getUserEntitlement(userId);
  if (!entitlement.hasPaidAccess) {
    return NextResponse.json({ error: "Paid companion access is required" }, { status: 403 });
  }

  const companion = await buildCompanionSyncPayload(userId);
  if (!companion) {
    return NextResponse.json({ error: "No active companion license" }, { status: 403 });
  }

  const license = await prisma.license.findFirst({
    where: { userId, key: companion.licenseKey },
    select: { id: true },
  });
  if (!license) {
    return NextResponse.json({ error: "No active companion license" }, { status: 403 });
  }

  const keyThumbprint = base64UrlSha256(
    Buffer.from(parsed.data.devicePublicKey, "base64url"),
  );
  const device = await registerMobileDevice({
    id: crypto.randomUUID(),
    userId,
    keyThumbprint,
    publicKeySpki: parsed.data.devicePublicKey,
    platform: parsed.data.platform,
    displayName: parsed.data.deviceName,
    appVersion: parsed.data.appVersion,
  });
  if (!device) {
    return NextResponse.json({ error: "Native device is unavailable" }, { status: 403 });
  }

  const issued = await issueMobileHandoff({
    userId,
    licenseId: license.id,
    deviceId: device.id,
    codeChallenge: parsed.data.codeChallenge,
    state: parsed.data.state,
    devicePublicKey: parsed.data.devicePublicKey,
  });
  await persistMobileAuthorizationCode({
    issued,
    userId,
    licenseId: license.id,
  });

  return NextResponse.json(
    { code: issued.token, expiresIn: 120 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
