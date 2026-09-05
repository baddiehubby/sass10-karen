import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/lib/api-json";
import { buildCompanionSyncPayload } from "@/lib/companion-sync";
import {
  issueMobileHandoff,
  validateBridgeState,
  validateCodeChallenge,
  validateDevicePublicKey,
} from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/session-user";

export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    codeChallenge: z.string().min(43).max(43),
    state: z.string().min(32).max(128),
    devicePublicKey: z.string().min(80).max(256),
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
  const userId = await sessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody(req, requestSchema);
  if (!parsed.ok) return parsed.response;

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

  const code = await issueMobileHandoff({
    userId,
    licenseId: license.id,
    codeChallenge: parsed.data.codeChallenge,
    state: parsed.data.state,
    devicePublicKey: parsed.data.devicePublicKey,
  });

  return NextResponse.json(
    { code, expiresIn: 120 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
