import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/lib/api-json";
import { getUserEntitlement } from "@/lib/billing/entitlement";
import { buildCompanionSyncPayload } from "@/lib/companion-sync";
import { isLicenseActive } from "@/lib/free-license";
import {
  base64UrlSha256,
  issueMobileRefresh,
  mobileCredentialVersion,
  verifyDeviceProof,
  verifyMobileHandoff,
  verifyMobileRefresh,
  verifyPkceVerifier,
} from "@/lib/mobile-auth";
import { getPresenceForLicense, upsertPresenceState } from "@/lib/presence-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const proofFields = {
  timestamp: z.number().int().positive(),
  nonce: z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/),
  proof: z.string().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/),
};

const requestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("exchange"),
      code: z.string().min(80).max(4096),
      verifier: z.string().min(43).max(128),
      state: z.string().min(32).max(128),
      ...proofFields,
    })
    .strict(),
  z
    .object({
      action: z.literal("refresh"),
      refreshToken: z.string().min(80).max(4096),
      ...proofFields,
    })
    .strict(),
]);

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function buildSessionResponse(input: {
  userId: string;
  licenseId: string;
  devicePublicKey: string;
}) {
  const [user, license] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, password: true },
    }),
    prisma.license.findUnique({
      where: { id: input.licenseId },
      select: {
        id: true,
        key: true,
        userId: true,
        expiresAt: true,
        plan: true,
        lemonSqueezySubscriptionStatus: true,
      },
    }),
  ]);
  if (!user || !license || license.userId !== user.id || !isLicenseActive(license)) {
    return null;
  }

  const [entitlement, companion] = await Promise.all([
    getUserEntitlement(user.id),
    buildCompanionSyncPayload(user.id),
  ]);
  if (!companion || companion.licenseKey !== license.key) return null;

  let presence = await getPresenceForLicense(license.key);
  if (entitlement.hasPaidAccess && presence) {
    presence = await upsertPresenceState({
      ...presence,
      lastCheckIn: new Date().toISOString(),
    });
  }

  const refresh = await issueMobileRefresh({
    userId: user.id,
    licenseId: license.id,
    credentialVersion: mobileCredentialVersion(user.password),
    devicePublicKey: input.devicePublicKey,
  });

  return {
    tokenType: "Device-Bound",
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
    entitlement: {
      hasPaidAccess: entitlement.hasPaidAccess,
      plan: entitlement.plan,
      status: entitlement.status,
      currentPeriodEnd: entitlement.currentPeriodEnd,
      subscriptionLabel: entitlement.subscriptionLabel,
    },
    companion: {
      companionName: companion.companionName,
      personality: companion.personality,
      companionType: companion.companionType,
      widget: companion.widget,
      syncedAt: companion.syncedAt,
    },
    presence: presence
      ? {
          currentMood: presence.currentMood,
          lastCheckIn: presence.lastCheckIn,
        }
      : null,
  };
}

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, requestSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (body.action === "exchange") {
    const handoff = await verifyMobileHandoff(body.code);
    if (
      !handoff ||
      handoff.sth !== base64UrlSha256(body.state) ||
      !verifyPkceVerifier(body.verifier, handoff.cch) ||
      !verifyDeviceProof({
        purpose: "exchange",
        credential: body.code,
        timestamp: body.timestamp,
        nonce: body.nonce,
        signature: body.proof,
        spki: handoff.spki,
      })
    ) {
      return noStoreJson({ error: "Invalid or expired connection" }, 401);
    }

    const session = await buildSessionResponse({
      userId: handoff.uid,
      licenseId: handoff.lid,
      devicePublicKey: handoff.spki,
    });
    return session
      ? noStoreJson(session)
      : noStoreJson({ error: "Account or entitlement is unavailable" }, 403);
  }

  const refreshClaims = await verifyMobileRefresh(body.refreshToken);
  if (
    !refreshClaims ||
    !verifyDeviceProof({
      purpose: "refresh",
      credential: body.refreshToken,
      timestamp: body.timestamp,
      nonce: body.nonce,
      signature: body.proof,
      spki: refreshClaims.spki,
    })
  ) {
    return noStoreJson({ error: "Native session expired" }, 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: refreshClaims.uid },
    select: { password: true },
  });
  if (!user || mobileCredentialVersion(user.password) !== refreshClaims.cv) {
    return noStoreJson({ error: "Native session expired" }, 401);
  }

  const session = await buildSessionResponse({
    userId: refreshClaims.uid,
    licenseId: refreshClaims.lid,
    devicePublicKey: refreshClaims.spki,
  });
  return session
    ? noStoreJson(session)
    : noStoreJson({ error: "Account or entitlement is unavailable" }, 403);
}
