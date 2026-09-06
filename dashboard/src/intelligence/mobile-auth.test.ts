import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import test from "node:test";
import { Prisma } from "@prisma/client";

import {
  base64UrlSha256,
  issueMobileHandoff,
  issueMobileRefresh,
  mobileCredentialVersion,
  mobileProofMessage,
  validateDevicePublicKey,
  validateRequestOrigin,
  verifyDeviceProof,
  verifyMobileHandoff,
  verifyMobileRefresh,
  verifyPkceVerifier,
} from "../../lib/mobile-auth";
import {
  exchangeAuthorizationCode,
  consumeMobileContextProof,
  hashMobileCredential,
  revokeOwnedMobileDevice,
  revokeMobileDevice,
  rotateMobileRefreshToken,
} from "../../lib/mobile-auth-store";

process.env.NEXTAUTH_SECRET = "mobile-auth-test-secret-at-least-32-characters";

type DeviceRow = {
  id: string;
  userId: string;
  licenseId: string;
  keyThumbprint: string;
  publicKeySpki: string;
  revokedAt: Date | null;
  lastSeenAt: Date | null;
};

type CodeRow = {
  id: string;
  jti: string;
  codeHash: string;
  userId: string;
  licenseId: string;
  deviceId: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

type RefreshRow = {
  id: string;
  jti: string;
  tokenHash: string;
  familyId: string;
  userId: string;
  licenseId: string;
  deviceId: string;
  credentialVersion: string;
  expiresAt: Date;
  lastUsedAt: Date | null;
  rotatedAt: Date | null;
  replacedByTokenId: string | null;
  revokedAt: Date | null;
};

type NonceRow = {
  id: string;
  deviceId: string;
  purpose: string;
  nonceHash: string;
  proofTime: Date;
  expiresAt: Date;
};

type StoreState = {
  devices: DeviceRow[];
  codes: CodeRow[];
  refreshTokens: RefreshRow[];
  nonces: NonceRow[];
};

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
  });
}

/**
 * Serialized transactions mirror the row-visibility outcome the store relies
 * on while cloning state gives failed transactions real rollback semantics.
 */
class SerializedMobileAuthDb {
  state: StoreState = {
    devices: [],
    codes: [],
    refreshTokens: [],
    nonces: [],
  };

  private tail: Promise<void> = Promise.resolve();

  private transactionClient(state: StoreState) {
    return {
      mobileAuthorizationCode: {
        findUnique: async ({ where }: { where: { codeHash: string } }) =>
          state.codes.find((row) => row.codeHash === where.codeHash) ?? null,
        updateMany: async ({
          where,
          data,
        }: {
          where: {
            id: string;
            consumedAt?: null;
            expiresAt?: { gt: Date };
          };
          data: Partial<CodeRow>;
        }) => {
          const rows = state.codes.filter(
            (row) =>
              row.id === where.id &&
              (where.consumedAt !== null || row.consumedAt === null) &&
              (!where.expiresAt || row.expiresAt > where.expiresAt.gt),
          );
          rows.forEach((row) => Object.assign(row, data));
          return { count: rows.length };
        },
      },
      mobileDevice: {
        updateMany: async ({
          where,
          data,
        }: {
          where: Partial<DeviceRow>;
          data: Partial<DeviceRow>;
        }) => {
          const rows = state.devices.filter(
            (row) =>
              (!where.id || row.id === where.id) &&
              (!where.userId || row.userId === where.userId) &&
              (where.revokedAt !== null || row.revokedAt === null) &&
              (!where.keyThumbprint || row.keyThumbprint === where.keyThumbprint) &&
              (!where.publicKeySpki || row.publicKeySpki === where.publicKeySpki),
          );
          rows.forEach((row) => Object.assign(row, data));
          return { count: rows.length };
        },
      },
      mobileRefreshToken: {
        findUnique: async ({ where }: { where: { tokenHash: string } }) =>
          state.refreshTokens.find((row) => row.tokenHash === where.tokenHash) ?? null,
        create: async ({ data }: { data: Omit<RefreshRow, "lastUsedAt" | "rotatedAt" | "replacedByTokenId" | "revokedAt"> }) => {
          if (
            state.refreshTokens.some(
              (row) =>
                row.id === data.id ||
                row.jti === data.jti ||
                row.tokenHash === data.tokenHash,
            )
          ) {
            throw uniqueViolation();
          }
          const created: RefreshRow = {
            ...data,
            lastUsedAt: null,
            rotatedAt: null,
            replacedByTokenId: null,
            revokedAt: null,
          };
          state.refreshTokens.push(created);
          return created;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: Partial<RefreshRow> & { expiresAt?: { gt: Date } };
          data: Partial<RefreshRow>;
        }) => {
          const rows = state.refreshTokens.filter(
            (row) =>
              (!where.id || row.id === where.id) &&
              (!where.familyId || row.familyId === where.familyId) &&
              (!where.deviceId || row.deviceId === where.deviceId) &&
              (!where.userId || row.userId === where.userId) &&
              (where.rotatedAt !== null || row.rotatedAt === null) &&
              (where.revokedAt !== null || row.revokedAt === null) &&
              (!where.expiresAt || row.expiresAt > where.expiresAt.gt),
          );
          rows.forEach((row) => Object.assign(row, data));
          return { count: rows.length };
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const index = state.refreshTokens.findIndex((row) => row.id === where.id);
          if (index < 0) throw new Error("Missing refresh token");
          return state.refreshTokens.splice(index, 1)[0];
        },
      },
      mobileProofNonce: {
        create: async ({ data }: { data: NonceRow }) => {
          if (
            state.nonces.some(
              (row) =>
                row.deviceId === data.deviceId &&
                row.purpose === data.purpose &&
                row.nonceHash === data.nonceHash,
            )
          ) {
            throw uniqueViolation();
          }
          state.nonces.push(data);
          return data;
        },
      },
    };
  }

  async $transaction<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.tail;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    const draft = structuredClone(this.state);
    try {
      const result = await work(this.transactionClient(draft));
      this.state = draft;
      return result;
    } finally {
      release();
    }
  }
}

type InjectedDatabase = NonNullable<
  Parameters<typeof exchangeAuthorizationCode>[1]
>;

const STORE_NOW = new Date("2026-09-06T00:00:00.000Z");
const STORE_EXPIRY = new Date("2026-09-07T00:00:00.000Z");
const STORE_USER = "user-store-test";
const STORE_LICENSE = "license-store-test";
const STORE_VERSION = "credential-version";

function seedDevice(
  db: SerializedMobileAuthDb,
  id: string,
  keyThumbprint = `thumb-${id}`,
  publicKeySpki = `spki-${id}`,
) {
  db.state.devices.push({
    id,
    userId: STORE_USER,
    licenseId: STORE_LICENSE,
    keyThumbprint,
    publicKeySpki,
    revokedAt: null,
    lastSeenAt: null,
  });
}

function seedCode(
  db: SerializedMobileAuthDb,
  input: { id: string; raw: string; deviceId: string; expiresAt?: Date },
) {
  db.state.codes.push({
    id: input.id,
    jti: `jti-${input.id}`,
    codeHash: hashMobileCredential(input.raw),
    userId: STORE_USER,
    licenseId: STORE_LICENSE,
    deviceId: input.deviceId,
    expiresAt: input.expiresAt ?? STORE_EXPIRY,
    consumedAt: null,
  });
}

function seedRefresh(
  db: SerializedMobileAuthDb,
  input: {
    id: string;
    raw: string;
    deviceId: string;
    familyId: string;
  },
) {
  db.state.refreshTokens.push({
    id: input.id,
    jti: `jti-${input.id}`,
    tokenHash: hashMobileCredential(input.raw),
    familyId: input.familyId,
    userId: STORE_USER,
    licenseId: STORE_LICENSE,
    deviceId: input.deviceId,
    credentialVersion: STORE_VERSION,
    expiresAt: STORE_EXPIRY,
    lastUsedAt: null,
    rotatedAt: null,
    replacedByTokenId: null,
    revokedAt: null,
  });
}

function handoffBinding(codeId: string, deviceId: string) {
  return {
    jti: `jti-${codeId}`,
    userId: STORE_USER,
    licenseId: STORE_LICENSE,
    deviceId,
    deviceThumbprint: `thumb-${deviceId}`,
    devicePublicKey: `spki-${deviceId}`,
  };
}

function refreshBinding(tokenId: string, deviceId: string, familyId: string) {
  return {
    ...handoffBinding(tokenId, deviceId),
    familyId,
    credentialVersion: STORE_VERSION,
  };
}

function nextRefresh(id: string, familyId: string) {
  return {
    id,
    token: `raw-${id}`,
    jti: `jti-${id}`,
    familyId,
    expiresAt: STORE_EXPIRY.getTime(),
    credentialVersion: STORE_VERSION,
  };
}

function deviceFixture() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const spki = publicKey.export({ format: "der", type: "spki" }).toString("base64url");
  return { privateKey, spki };
}

test("mobile handoff is PKCE- and device-bound", async () => {
  const device = deviceFixture();
  const verifier = randomBytes(48).toString("base64url");
  const state = randomBytes(32).toString("base64url");
  const issued = await issueMobileHandoff({
    userId: "user_mobile_test",
    licenseId: "license_mobile_test",
    deviceId: "device_mobile_test",
    codeChallenge: base64UrlSha256(verifier),
    state,
    devicePublicKey: device.spki,
    now: 1_800_000_000_000,
  });

  const claims = await verifyMobileHandoff(issued.token);
  assert.ok(claims);
  assert.equal(claims.uid, "user_mobile_test");
  assert.equal(claims.lid, "license_mobile_test");
  assert.equal(claims.did, "device_mobile_test");
  assert.equal(claims.jti, issued.jti);
  assert.equal(claims.sth, base64UrlSha256(state));
  assert.equal(verifyPkceVerifier(verifier, claims.cch), true);
  assert.equal(verifyPkceVerifier(`${verifier}x`, claims.cch), false);
  assert.equal(issued.expiresAt, 1_800_000_120_000);
});

test("device proof rejects tampering and stale timestamps", () => {
  const device = deviceFixture();
  const credential = "signed-credential-value";
  const timestamp = Date.now();
  const nonce = randomBytes(24).toString("base64url");
  const message = mobileProofMessage({
    purpose: "exchange",
    credential,
    timestamp,
    nonce,
  });
  const signature = sign("sha256", Buffer.from(message), device.privateKey).toString("base64url");

  assert.equal(
    verifyDeviceProof({
      purpose: "exchange",
      credential,
      timestamp,
      nonce,
      signature,
      spki: device.spki,
      now: timestamp,
    }),
    true,
  );
  assert.equal(
    verifyDeviceProof({
      purpose: "exchange",
      credential: `${credential}-tampered`,
      timestamp,
      nonce,
      signature,
      spki: device.spki,
      now: timestamp,
    }),
    false,
  );
  assert.equal(
    verifyDeviceProof({
      purpose: "exchange",
      credential,
      timestamp,
      nonce,
      signature,
      spki: device.spki,
      now: timestamp + 61_000,
    }),
    false,
  );
});

test("refresh credentials retain device and credential-version binding", async () => {
  const device = deviceFixture();
  assert.equal(validateDevicePublicKey(device.spki), true);

  const issued = await issueMobileRefresh({
    userId: "user_mobile_test",
    licenseId: "license_mobile_test",
    deviceId: "device_mobile_test",
    familyId: "family_mobile_test",
    credentialVersion: mobileCredentialVersion("password-hash"),
    devicePublicKey: device.spki,
  });
  const claims = await verifyMobileRefresh(issued.token);

  assert.ok(claims);
  assert.equal(claims.uid, "user_mobile_test");
  assert.equal(claims.lid, "license_mobile_test");
  assert.equal(claims.did, "device_mobile_test");
  assert.equal(claims.fid, "family_mobile_test");
  assert.equal(claims.jti, issued.jti);
  assert.equal(claims.cv, mobileCredentialVersion("password-hash"));
  assert.equal(claims.spki, device.spki);
  assert.ok(issued.expiresAt > Date.now());
});

test("refresh persistence hashes the raw high-entropy JWE", async () => {
  const device = deviceFixture();
  const issued = await issueMobileRefresh({
    userId: "user_mobile_test",
    licenseId: "license_mobile_test",
    deviceId: "device_mobile_test",
    credentialVersion: mobileCredentialVersion("password-hash"),
    devicePublicKey: device.spki,
  });

  const hash = hashMobileCredential(issued.token);
  assert.equal(hash, base64UrlSha256(issued.token));
  assert.notEqual(hash, issued.token);
  assert.equal(hash.length, 43);
  assert.notEqual(hashMobileCredential(`${issued.token}x`), hash);
});

test("logout proof is purpose-bound", () => {
  const device = deviceFixture();
  const credential = "refresh-jwe";
  const timestamp = 1_800_000_000_000;
  const nonce = randomBytes(24).toString("base64url");
  const signature = sign(
    "sha256",
    Buffer.from(mobileProofMessage({ purpose: "logout", credential, timestamp, nonce })),
    device.privateKey,
  ).toString("base64url");

  assert.equal(
    verifyDeviceProof({
      purpose: "logout",
      credential,
      timestamp,
      nonce,
      signature,
      spki: device.spki,
      now: timestamp,
    }),
    true,
  );
  assert.equal(
    verifyDeviceProof({
      purpose: "refresh",
      credential,
      timestamp,
      nonce,
      signature,
      spki: device.spki,
      now: timestamp,
    }),
    false,
  );
});

test("concurrent authorization-code exchange has exactly one success", async () => {
  const db = new SerializedMobileAuthDb();
  seedDevice(db, "device-a");
  seedCode(db, { id: "code-1", raw: "raw-code-1", deviceId: "device-a" });
  const database = db as unknown as InjectedDatabase;

  const results = await Promise.all(
    ["token-1", "token-2"].map((tokenId, index) =>
      exchangeAuthorizationCode(
        {
          code: "raw-code-1",
          handoff: handoffBinding("code-1", "device-a"),
          proof: {
            purpose: "exchange",
            nonce: `exchange-nonce-${index}`,
            timestamp: STORE_NOW.getTime(),
          },
          refresh: nextRefresh(tokenId, `family-${index}`),
          now: STORE_NOW,
        },
        database,
      ),
    ),
  );

  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(db.state.codes[0].consumedAt?.getTime(), STORE_NOW.getTime());
  assert.equal(db.state.refreshTokens.length, 1);
  assert.equal(
    ["jti-token-1", "jti-token-2"].includes(db.state.refreshTokens[0].jti),
    true,
  );
});

test("expired authorization code fails without creating a refresh token", async () => {
  const db = new SerializedMobileAuthDb();
  seedDevice(db, "device-a");
  seedCode(db, {
    id: "code-expired",
    raw: "raw-code-expired",
    deviceId: "device-a",
    expiresAt: new Date(STORE_NOW.getTime() - 1),
  });

  const exchanged = await exchangeAuthorizationCode(
    {
      code: "raw-code-expired",
      handoff: handoffBinding("code-expired", "device-a"),
      proof: {
        purpose: "exchange",
        nonce: "expired-code-nonce",
        timestamp: STORE_NOW.getTime(),
      },
      refresh: nextRefresh("token-expired", "family-expired"),
      now: STORE_NOW,
    },
    db as unknown as InjectedDatabase,
  );

  assert.equal(exchanged, false);
  assert.equal(db.state.codes[0].consumedAt, null);
  assert.equal(db.state.refreshTokens.length, 0);
  assert.equal(db.state.nonces.length, 0);
});

test("T1 rotates to T2 and records successor usage", async () => {
  const db = new SerializedMobileAuthDb();
  seedDevice(db, "device-a");
  seedRefresh(db, {
    id: "T1",
    raw: "raw-T1",
    deviceId: "device-a",
    familyId: "family-a",
  });

  const result = await rotateMobileRefreshToken(
    {
      oldToken: "raw-T1",
      old: refreshBinding("T1", "device-a", "family-a"),
      proof: {
        purpose: "refresh",
        nonce: "rotation-nonce-1",
        timestamp: STORE_NOW.getTime(),
      },
      next: nextRefresh("T2", "family-a"),
      now: STORE_NOW,
    },
    db as unknown as InjectedDatabase,
  );

  assert.equal(result, "rotated");
  const t1 = db.state.refreshTokens.find((row) => row.id === "T1");
  const t2 = db.state.refreshTokens.find((row) => row.id === "T2");
  assert.equal(t1?.rotatedAt?.getTime(), STORE_NOW.getTime());
  assert.equal(t1?.lastUsedAt?.getTime(), STORE_NOW.getTime());
  assert.equal(t1?.replacedByTokenId, "T2");
  assert.equal(t2?.jti, "jti-T2");
  assert.equal(t2?.revokedAt, null);
});

test("T1 reuse revokes its refresh family and device", async () => {
  const db = new SerializedMobileAuthDb();
  seedDevice(db, "device-a");
  seedRefresh(db, {
    id: "T1",
    raw: "raw-T1",
    deviceId: "device-a",
    familyId: "family-a",
  });
  const database = db as unknown as InjectedDatabase;

  assert.equal(
    await rotateMobileRefreshToken(
      {
        oldToken: "raw-T1",
        old: refreshBinding("T1", "device-a", "family-a"),
        proof: {
          purpose: "refresh",
          nonce: "rotation-nonce-1",
          timestamp: STORE_NOW.getTime(),
        },
        next: nextRefresh("T2", "family-a"),
        now: STORE_NOW,
      },
      database,
    ),
    "rotated",
  );
  assert.equal(
    await rotateMobileRefreshToken(
      {
        oldToken: "raw-T1",
        old: refreshBinding("T1", "device-a", "family-a"),
        proof: {
          purpose: "refresh",
          nonce: "reuse-nonce",
          timestamp: STORE_NOW.getTime() + 1,
        },
        next: nextRefresh("T3", "family-a"),
        now: new Date(STORE_NOW.getTime() + 1),
      },
      database,
    ),
    "reused",
  );

  assert.ok(db.state.devices[0].revokedAt);
  assert.equal(
    db.state.refreshTokens
      .filter((row) => row.familyId === "family-a")
      .every((row) => row.revokedAt !== null),
    true,
  );
  assert.equal(db.state.refreshTokens.some((row) => row.id === "T3"), false);
});

test("concurrent T1 refresh leaves no multiple usable successors", async () => {
  const db = new SerializedMobileAuthDb();
  seedDevice(db, "device-a");
  seedRefresh(db, {
    id: "T1",
    raw: "raw-T1",
    deviceId: "device-a",
    familyId: "family-a",
  });
  const database = db as unknown as InjectedDatabase;

  const results = await Promise.all(
    ["T2", "T3"].map((nextId, index) =>
      rotateMobileRefreshToken(
        {
          oldToken: "raw-T1",
          old: refreshBinding("T1", "device-a", "family-a"),
          proof: {
            purpose: "refresh",
            nonce: `concurrent-refresh-${index}`,
            timestamp: STORE_NOW.getTime() + index,
          },
          next: nextRefresh(nextId, "family-a"),
          now: new Date(STORE_NOW.getTime() + index),
        },
        database,
      ),
    ),
  );

  assert.deepEqual([...results].sort(), ["reused", "rotated"]);
  assert.equal(
    db.state.refreshTokens.filter(
      (row) =>
        row.familyId === "family-a" &&
        row.rotatedAt === null &&
        row.revokedAt === null,
    ).length,
    0,
  );
  assert.equal(
    db.state.refreshTokens.filter((row) => row.id === "T2" || row.id === "T3").length,
    1,
  );
});

test("revoking Device A leaves Device B and its token active", async () => {
  const db = new SerializedMobileAuthDb();
  seedDevice(db, "device-a");
  seedDevice(db, "device-b");
  seedRefresh(db, {
    id: "token-a",
    raw: "raw-token-a",
    deviceId: "device-a",
    familyId: "family-a",
  });
  seedRefresh(db, {
    id: "token-b",
    raw: "raw-token-b",
    deviceId: "device-b",
    familyId: "family-b",
  });

  await revokeMobileDevice(
    "device-a",
    STORE_NOW,
    db as unknown as InjectedDatabase,
  );

  assert.ok(db.state.devices.find((row) => row.id === "device-a")?.revokedAt);
  assert.equal(db.state.devices.find((row) => row.id === "device-b")?.revokedAt, null);
  assert.ok(db.state.refreshTokens.find((row) => row.id === "token-a")?.revokedAt);
  assert.equal(db.state.refreshTokens.find((row) => row.id === "token-b")?.revokedAt, null);
});

test("owner-scoped revocation cannot revoke another user's device", async () => {
  const db = new SerializedMobileAuthDb();
  seedDevice(db, "device-a");
  seedRefresh(db, {
    id: "token-a",
    raw: "raw-token-a",
    deviceId: "device-a",
    familyId: "family-a",
  });

  const revoked = await revokeOwnedMobileDevice(
    { userId: "different-user", deviceId: "device-a", now: STORE_NOW },
    db as unknown as InjectedDatabase,
  );
  assert.equal(revoked, false);
  assert.equal(db.state.devices[0].revokedAt, null);
  assert.equal(db.state.refreshTokens[0].revokedAt, null);
});

test("context proof is one-time and does not rotate its refresh token", async () => {
  const db = new SerializedMobileAuthDb();
  seedDevice(db, "device-a");
  seedRefresh(db, {
    id: "T1",
    raw: "raw-T1",
    deviceId: "device-a",
    familyId: "family-a",
  });
  const database = db as unknown as InjectedDatabase;
  const input = {
    token: "raw-T1",
    refresh: refreshBinding("T1", "device-a", "family-a"),
    proof: {
      purpose: "context" as const,
      nonce: "context-proof-nonce",
      timestamp: STORE_NOW.getTime(),
    },
    now: STORE_NOW,
  };

  assert.equal(await consumeMobileContextProof(input, database), true);
  assert.equal(await consumeMobileContextProof(input, database), false);
  assert.equal(db.state.refreshTokens[0].rotatedAt, null);
  assert.equal(db.state.refreshTokens[0].replacedByTokenId, null);
  assert.equal(db.state.nonces.length, 1);
});

test("context rejects revoked and rotated refresh tokens", async () => {
  for (const state of ["revoked", "rotated"] as const) {
    const db = new SerializedMobileAuthDb();
    seedDevice(db, "device-a");
    seedRefresh(db, {
      id: "T1",
      raw: "raw-T1",
      deviceId: "device-a",
      familyId: "family-a",
    });
    if (state === "revoked") db.state.refreshTokens[0].revokedAt = STORE_NOW;
    else db.state.refreshTokens[0].rotatedAt = STORE_NOW;

    assert.equal(
      await consumeMobileContextProof(
        {
          token: "raw-T1",
          refresh: refreshBinding("T1", "device-a", "family-a"),
          proof: {
            purpose: "context",
            nonce: `context-${state}-nonce`,
            timestamp: STORE_NOW.getTime(),
          },
          now: STORE_NOW,
        },
        db as unknown as InjectedDatabase,
      ),
      false,
    );
    assert.equal(db.state.nonces.length, 0);
  }
});

test("nonce replay is rejected and rolls back the second exchange", async () => {
  const db = new SerializedMobileAuthDb();
  seedDevice(db, "device-a");
  seedCode(db, { id: "code-1", raw: "raw-code-1", deviceId: "device-a" });
  seedCode(db, { id: "code-2", raw: "raw-code-2", deviceId: "device-a" });
  const database = db as unknown as InjectedDatabase;
  const proof = {
    purpose: "exchange" as const,
    nonce: "one-device-purpose-nonce",
    timestamp: STORE_NOW.getTime(),
  };

  assert.equal(
    await exchangeAuthorizationCode(
      {
        code: "raw-code-1",
        handoff: handoffBinding("code-1", "device-a"),
        proof,
        refresh: nextRefresh("token-1", "family-1"),
        now: STORE_NOW,
      },
      database,
    ),
    true,
  );
  assert.equal(
    await exchangeAuthorizationCode(
      {
        code: "raw-code-2",
        handoff: handoffBinding("code-2", "device-a"),
        proof,
        refresh: nextRefresh("token-2", "family-2"),
        now: STORE_NOW,
      },
      database,
    ),
    false,
  );

  assert.equal(db.state.nonces.length, 1);
  assert.equal(db.state.codes.find((row) => row.id === "code-2")?.consumedAt, null);
  assert.equal(db.state.refreshTokens.some((row) => row.id === "token-2"), false);
});

test("invalid public keys are rejected", () => {
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64url");
  assert.equal(validateDevicePublicKey(rsa), false);
  assert.equal(validateDevicePublicKey("not-a-key"), false);
});

test("mobile handoff origin validation is fail-closed", () => {
  assert.equal(
    validateRequestOrigin(
      "https://www.buddieai.com",
      "https://www.buddieai.com",
    ),
    true,
  );
  assert.equal(
    validateRequestOrigin(
      "https://evil.example",
      "https://www.buddieai.com",
    ),
    false,
  );
  assert.equal(validateRequestOrigin(null, "https://www.buddieai.com"), false);
});
