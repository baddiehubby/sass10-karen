import { Prisma, type MobileRefreshToken } from "@prisma/client";

import { base64UrlSha256, type IssuedMobileHandoff } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

const PROOF_NONCE_RETENTION_MS = 2 * 60_000;

type IssuedRefreshRecord = {
  id: string;
  token: string;
  jti: string;
  familyId: string;
  expiresAt: number;
  credentialVersion: string;
};

type BoundCredential = {
  jti: string;
  userId: string;
  licenseId: string;
  deviceId: string;
  deviceThumbprint: string;
  devicePublicKey: string;
};

type ProofNonce = {
  purpose: "exchange" | "refresh" | "logout" | "context";
  nonce: string;
  timestamp: number;
};

export function hashMobileCredential(rawCredential: string): string {
  return base64UrlSha256(rawCredential);
}

function nonceData(deviceId: string, proof: ProofNonce) {
  return {
    id: crypto.randomUUID(),
    deviceId,
    purpose: proof.purpose,
    nonceHash: base64UrlSha256(proof.nonce),
    proofTime: new Date(proof.timestamp),
    expiresAt: new Date(proof.timestamp + PROOF_NONCE_RETENTION_MS),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function revokeFamilyAndDevice(
  tx: Prisma.TransactionClient,
  familyId: string,
  deviceId: string,
  at: Date,
) {
  await tx.mobileRefreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: at },
  });
  await tx.mobileDevice.updateMany({
    where: { id: deviceId, revokedAt: null },
    data: { revokedAt: at },
  });
}

export async function registerMobileDevice(input: {
  id: string;
  userId: string;
  keyThumbprint: string;
  publicKeySpki: string;
  platform?: "android" | "ios";
  displayName?: string;
  appVersion?: string;
  now?: Date;
}, database: typeof prisma = prisma): Promise<{ id: string } | null> {
  const now = input.now ?? new Date();
  const device = await database.mobileDevice.upsert({
    where: { keyThumbprint: input.keyThumbprint },
    create: {
      id: input.id,
      userId: input.userId,
      keyThumbprint: input.keyThumbprint,
      publicKeySpki: input.publicKeySpki,
      platform: input.platform,
      displayName: input.displayName,
      appVersion: input.appVersion,
      lastSeenAt: now,
    },
    update: {
      lastSeenAt: now,
      ...(input.platform ? { platform: input.platform } : {}),
      ...(input.displayName ? { displayName: input.displayName } : {}),
      ...(input.appVersion ? { appVersion: input.appVersion } : {}),
    },
  });
  if (
    device.revokedAt ||
    device.userId !== input.userId ||
    device.publicKeySpki !== input.publicKeySpki
  ) {
    return null;
  }
  return { id: device.id };
}

export async function persistMobileAuthorizationCode(input: {
  issued: IssuedMobileHandoff;
  userId: string;
  licenseId: string;
}, database: typeof prisma = prisma): Promise<void> {
  await database.mobileAuthorizationCode.create({
    data: {
      id: crypto.randomUUID(),
      jti: input.issued.jti,
      codeHash: hashMobileCredential(input.issued.token),
      userId: input.userId,
      licenseId: input.licenseId,
      deviceId: input.issued.deviceId,
      expiresAt: new Date(input.issued.expiresAt),
    },
  });
}

function refreshCreateData(input: IssuedRefreshRecord & BoundCredential) {
  return {
    id: input.id,
    jti: input.jti,
    tokenHash: hashMobileCredential(input.token),
    familyId: input.familyId,
    userId: input.userId,
    licenseId: input.licenseId,
    deviceId: input.deviceId,
    credentialVersion: input.credentialVersion,
    expiresAt: new Date(input.expiresAt),
  };
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  handoff: BoundCredential;
  proof: ProofNonce;
  refresh: IssuedRefreshRecord;
  now?: Date;
}, database: typeof prisma = prisma): Promise<boolean> {
  const now = input.now ?? new Date();
  try {
    return await database.$transaction(async (tx) => {
      const code = await tx.mobileAuthorizationCode.findUnique({
        where: { codeHash: hashMobileCredential(input.code) },
      });
      if (
        !code ||
        code.jti !== input.handoff.jti ||
        code.userId !== input.handoff.userId ||
        code.licenseId !== input.handoff.licenseId ||
        code.deviceId !== input.handoff.deviceId ||
        code.consumedAt ||
        code.expiresAt <= now
      ) {
        return false;
      }

      // This conditional write both checks active binding and locks the device
      // row, serializing credential creation against concurrent revocation.
      const activeDevice = await tx.mobileDevice.updateMany({
        where: {
          id: code.deviceId,
          revokedAt: null,
          keyThumbprint: input.handoff.deviceThumbprint,
          publicKeySpki: input.handoff.devicePublicKey,
        },
        data: { lastSeenAt: now },
      });
      if (activeDevice.count !== 1) return false;

      const consumed = await tx.mobileAuthorizationCode.updateMany({
        where: {
          id: code.id,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return false;

      await tx.mobileProofNonce.create({
        data: nonceData(code.deviceId, input.proof),
      });
      await tx.mobileRefreshToken.create({
        data: refreshCreateData({ ...input.handoff, ...input.refresh }),
      });
      return true;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

function refreshMatches(
  stored: MobileRefreshToken,
  bound: BoundCredential & { familyId: string; credentialVersion: string },
) {
  return (
    stored.jti === bound.jti &&
    stored.familyId === bound.familyId &&
    stored.userId === bound.userId &&
    stored.licenseId === bound.licenseId &&
    stored.deviceId === bound.deviceId &&
    stored.credentialVersion === bound.credentialVersion
  );
}

export async function rotateMobileRefreshToken(input: {
  oldToken: string;
  old: BoundCredential & { familyId: string; credentialVersion: string };
  proof: ProofNonce;
  next: IssuedRefreshRecord;
  now?: Date;
}, database: typeof prisma = prisma): Promise<"rotated" | "reused" | "invalid"> {
  const now = input.now ?? new Date();
  try {
    return await database.$transaction(async (tx) => {
      const old = await tx.mobileRefreshToken.findUnique({
        where: { tokenHash: hashMobileCredential(input.oldToken) },
      });
      if (!old || !refreshMatches(old, input.old) || old.expiresAt <= now) {
        return "invalid";
      }

      if (old.rotatedAt || old.revokedAt) {
        await revokeFamilyAndDevice(tx, old.familyId, old.deviceId, now);
        return "reused";
      }

      // Lock the active device before claiming the token. Revocation also
      // updates this row first, so either all new family state precedes and is
      // caught by the revoke, or rotation observes the revoked device.
      const activeDevice = await tx.mobileDevice.updateMany({
        where: {
          id: old.deviceId,
          revokedAt: null,
          keyThumbprint: input.old.deviceThumbprint,
          publicKeySpki: input.old.devicePublicKey,
        },
        data: { lastSeenAt: now },
      });
      if (activeDevice.count !== 1) {
        await revokeFamilyAndDevice(tx, old.familyId, old.deviceId, now);
        return "reused";
      }

      // Create the successor before linking it so the self-referential
      // replacedByTokenId foreign key is valid inside the transaction.
      await tx.mobileRefreshToken.create({
        data: refreshCreateData({ ...input.old, ...input.next }),
      });
      const claimed = await tx.mobileRefreshToken.updateMany({
        where: {
          id: old.id,
          rotatedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          lastUsedAt: now,
          rotatedAt: now,
          replacedByTokenId: input.next.id,
        },
      });
      if (claimed.count !== 1) {
        await tx.mobileRefreshToken.delete({ where: { id: input.next.id } });
        await revokeFamilyAndDevice(tx, old.familyId, old.deviceId, now);
        return "reused";
      }

      await tx.mobileProofNonce.create({
        data: nonceData(old.deviceId, input.proof),
      });
      return "rotated";
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "invalid";
    throw error;
  }
}

export async function revokeMobileDevice(
  deviceId: string,
  at = new Date(),
  database: typeof prisma = prisma,
) {
  await database.$transaction(async (tx) => {
    await tx.mobileDevice.updateMany({
      where: { id: deviceId, revokedAt: null },
      data: { revokedAt: at },
    });
    await tx.mobileRefreshToken.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: at },
    });
  });
}

export async function listOwnedMobileDevices(
  userId: string,
  database: typeof prisma = prisma,
) {
  return database.mobileDevice.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      platform: true,
      displayName: true,
      appVersion: true,
      revokedAt: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });
}

export async function revokeOwnedMobileDevice(
  input: { userId: string; deviceId: string; now?: Date },
  database: typeof prisma = prisma,
): Promise<boolean> {
  const now = input.now ?? new Date();
  return database.$transaction(async (tx) => {
    const owned = await tx.mobileDevice.updateMany({
      where: { id: input.deviceId, userId: input.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    if (owned.count !== 1) return false;
    await tx.mobileRefreshToken.updateMany({
      where: { deviceId: input.deviceId, userId: input.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    return true;
  });
}

export async function consumeMobileContextProof(input: {
  token: string;
  refresh: BoundCredential & { familyId: string; credentialVersion: string };
  proof: ProofNonce;
  now?: Date;
}, database: typeof prisma = prisma): Promise<boolean> {
  const now = input.now ?? new Date();
  try {
    return await database.$transaction(async (tx) => {
      const stored = await tx.mobileRefreshToken.findUnique({
        where: { tokenHash: hashMobileCredential(input.token) },
      });
      if (
        !stored ||
        !refreshMatches(stored, input.refresh) ||
        stored.expiresAt <= now ||
        stored.rotatedAt ||
        stored.revokedAt
      ) return false;

      const activeDevice = await tx.mobileDevice.updateMany({
        where: {
          id: stored.deviceId,
          userId: stored.userId,
          revokedAt: null,
          keyThumbprint: input.refresh.deviceThumbprint,
          publicKeySpki: input.refresh.devicePublicKey,
        },
        data: { lastSeenAt: now },
      });
      if (activeDevice.count !== 1) return false;

      const activeToken = await tx.mobileRefreshToken.updateMany({
        where: {
          id: stored.id,
          rotatedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { lastUsedAt: now },
      });
      if (activeToken.count !== 1) return false;
      await tx.mobileProofNonce.create({
        data: nonceData(stored.deviceId, input.proof),
      });
      return true;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

export async function revokeAllMobileDevices(
  userId: string,
  at = new Date(),
  database: typeof prisma = prisma,
) {
  await database.$transaction(async (tx) => {
    await tx.mobileDevice.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at },
    });
    await tx.mobileRefreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at },
    });
  });
}

export async function logoutMobileDevice(input: {
  token: string;
  refresh: BoundCredential & { familyId: string; credentialVersion: string };
  proof: ProofNonce;
  now?: Date;
}, database: typeof prisma = prisma): Promise<boolean> {
  const now = input.now ?? new Date();
  try {
    return await database.$transaction(async (tx) => {
      const stored = await tx.mobileRefreshToken.findUnique({
        where: { tokenHash: hashMobileCredential(input.token) },
      });
      if (!stored || !refreshMatches(stored, input.refresh)) return false;

      await tx.mobileProofNonce.create({
        data: nonceData(stored.deviceId, input.proof),
      });
      await tx.mobileDevice.updateMany({
        where: { id: stored.deviceId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.mobileRefreshToken.updateMany({
        where: { deviceId: stored.deviceId, revokedAt: null },
        data: { revokedAt: now },
      });
      return true;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}
