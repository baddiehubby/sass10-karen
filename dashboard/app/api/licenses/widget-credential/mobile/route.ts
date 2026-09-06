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
import {
  exchangeAuthorizationCode,
  logoutMobileDevice,
  rotateMobileRefreshToken,
} from "@/lib/mobile-auth-store";
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
  z
    .object({
      action: z.literal("logout"),
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

async function loadSessionContext(input: {
  userId: string;
  licenseId: string;
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
  if (
    !entitlement.hasPaidAccess ||
    !companion ||
    companion.licenseKey !== license.key
  ) {
    return null;
  }

  return { user, license, entitlement, companion };
}

async function buildSessionResponse(
  context: NonNullable<Awaited<ReturnType<typeof loadSessionContext>>>,
  refresh: { token: string; expiresAt: number },
) {
  const { license, entitlement, companion } = context;
  let presence = await getPresenceForLicense(license.key);
  if (presence) {
    presence = await upsertPresenceState({
      ...presence,
      lastCheckIn: new Date().toISOString(),
    });
  }

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

    const context = await loadSessionContext({
      userId: handoff.uid,
      licenseId: handoff.lid,
    });
    if (!context) {
      return noStoreJson({ error: "Account or entitlement is unavailable" }, 403);
    }

    const refresh = await issueMobileRefresh({
      userId: context.user.id,
      licenseId: context.license.id,
      deviceId: handoff.did,
      credentialVersion: mobileCredentialVersion(context.user.password),
      devicePublicKey: handoff.spki,
    });
    const exchanged = await exchangeAuthorizationCode({
      code: body.code,
      handoff: {
        jti: handoff.jti!,
        userId: handoff.uid,
        licenseId: handoff.lid,
        deviceId: handoff.did,
        deviceThumbprint: handoff.dkt,
        devicePublicKey: handoff.spki,
      },
      proof: {
        purpose: "exchange",
        nonce: body.nonce,
        timestamp: body.timestamp,
      },
      refresh: {
        id: crypto.randomUUID(),
        ...refresh,
        credentialVersion: mobileCredentialVersion(context.user.password),
      },
    });
    if (!exchanged) {
      return noStoreJson({ error: "Invalid or expired connection" }, 401);
    }
    return noStoreJson(await buildSessionResponse(context, refresh));
  }

  const refreshClaims = await verifyMobileRefresh(body.refreshToken);
  const proofPurpose = body.action === "logout" ? "logout" : "refresh";
  if (
    !refreshClaims ||
    !verifyDeviceProof({
      purpose: proofPurpose,
      credential: body.refreshToken,
      timestamp: body.timestamp,
      nonce: body.nonce,
      signature: body.proof,
      spki: refreshClaims.spki,
    })
  ) {
    return noStoreJson({ error: "Native session expired" }, 401);
  }

  const refreshBinding = {
    jti: refreshClaims.jti!,
    userId: refreshClaims.uid,
    licenseId: refreshClaims.lid,
    deviceId: refreshClaims.did,
    familyId: refreshClaims.fid,
    credentialVersion: refreshClaims.cv,
    deviceThumbprint: refreshClaims.dkt,
    devicePublicKey: refreshClaims.spki,
  };

  if (body.action === "logout") {
    const loggedOut = await logoutMobileDevice({
      token: body.refreshToken,
      refresh: refreshBinding,
      proof: {
        purpose: "logout",
        nonce: body.nonce,
        timestamp: body.timestamp,
      },
    });
    return loggedOut
      ? noStoreJson({ ok: true })
      : noStoreJson({ error: "Native session expired" }, 401);
  }

  const context = await loadSessionContext({
    userId: refreshClaims.uid,
    licenseId: refreshClaims.lid,
  });
  if (!context) {
    return noStoreJson({ error: "Account or entitlement is unavailable" }, 403);
  }
  if (mobileCredentialVersion(context.user.password) !== refreshClaims.cv) {
    return noStoreJson({ error: "Native session expired" }, 401);
  }

  const nextRefresh = await issueMobileRefresh({
    userId: context.user.id,
    licenseId: context.license.id,
    deviceId: refreshClaims.did,
    familyId: refreshClaims.fid,
    credentialVersion: refreshClaims.cv,
    devicePublicKey: refreshClaims.spki,
  });
  const rotation = await rotateMobileRefreshToken({
    oldToken: body.refreshToken,
    old: refreshBinding,
    proof: {
      purpose: "refresh",
      nonce: body.nonce,
      timestamp: body.timestamp,
    },
    next: {
      id: crypto.randomUUID(),
      ...nextRefresh,
      credentialVersion: refreshClaims.cv,
    },
  });
  if (rotation !== "rotated") {
    return noStoreJson({ error: "Native session expired" }, 401);
  }

  return noStoreJson(await buildSessionResponse(context, nextRefresh));
}
