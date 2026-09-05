import {
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  verify as verifySignature,
} from "crypto";
import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";

const ISSUER = "buddieai-mobile-bridge";
const HANDOFF_AUDIENCE = "buddieai-android-exchange";
const REFRESH_AUDIENCE = "buddieai-android-refresh";
const HANDOFF_TTL_SECONDS = 2 * 60;
const REFRESH_TTL_SECONDS = 14 * 24 * 60 * 60;
const CLOCK_SKEW_MS = 60_000;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

type HandoffClaims = JWTPayload & {
  typ: "buddie_mobile_handoff";
  uid: string;
  lid: string;
  cch: string;
  sth: string;
  spki: string;
  dkt: string;
};

type RefreshClaims = JWTPayload & {
  typ: "buddie_mobile_refresh";
  uid: string;
  lid: string;
  cv: string;
  spki: string;
  dkt: string;
};

function encryptionKey(context: "handoff" | "refresh"): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for mobile authentication");
  return createHmac("sha256", secret)
    .update(`buddie-mobile-auth:v1:${context}`, "utf8")
    .digest();
}

export function base64UrlSha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function mobileCredentialVersion(passwordHash: string): string {
  return base64UrlSha256(`buddie-mobile-credential:v1:${passwordHash}`).slice(0, 24);
}

export function validateCodeChallenge(value: string): boolean {
  return value.length === 43 && BASE64URL_RE.test(value);
}

export function validateBridgeState(value: string): boolean {
  return value.length >= 32 && value.length <= 128 && BASE64URL_RE.test(value);
}

export function validateDevicePublicKey(spki: string): boolean {
  if (spki.length < 80 || spki.length > 256 || !BASE64URL_RE.test(spki)) return false;
  try {
    const key = createPublicKey({
      key: Buffer.from(spki, "base64url"),
      format: "der",
      type: "spki",
    });
    return (
      key.asymmetricKeyType === "ec" &&
      key.asymmetricKeyDetails?.namedCurve === "prime256v1"
    );
  } catch {
    return false;
  }
}

export function verifyPkceVerifier(verifier: string, challenge: string): boolean {
  return (
    verifier.length >= 43 &&
    verifier.length <= 128 &&
    BASE64URL_RE.test(verifier) &&
    base64UrlSha256(verifier) === challenge
  );
}

export function mobileProofMessage(input: {
  purpose: "exchange" | "refresh";
  credential: string;
  timestamp: number;
  nonce: string;
}): string {
  return [
    "buddie-mobile-proof-v1",
    input.purpose,
    base64UrlSha256(input.credential),
    String(input.timestamp),
    input.nonce,
  ].join("\n");
}

export function verifyDeviceProof(input: {
  purpose: "exchange" | "refresh";
  credential: string;
  timestamp: number;
  nonce: string;
  signature: string;
  spki: string;
  now?: number;
}): boolean {
  const now = input.now ?? Date.now();
  if (!Number.isSafeInteger(input.timestamp) || Math.abs(now - input.timestamp) > CLOCK_SKEW_MS) {
    return false;
  }
  if (
    input.nonce.length < 16 ||
    input.nonce.length > 128 ||
    !BASE64URL_RE.test(input.nonce) ||
    !BASE64URL_RE.test(input.signature) ||
    !validateDevicePublicKey(input.spki)
  ) {
    return false;
  }

  try {
    const key = createPublicKey({
      key: Buffer.from(input.spki, "base64url"),
      format: "der",
      type: "spki",
    });
    return verifySignature(
      "sha256",
      Buffer.from(mobileProofMessage(input), "utf8"),
      key,
      Buffer.from(input.signature, "base64url"),
    );
  } catch {
    return false;
  }
}

export async function issueMobileHandoff(input: {
  userId: string;
  licenseId: string;
  codeChallenge: string;
  state: string;
  devicePublicKey: string;
}): Promise<string> {
  if (
    !input.userId ||
    !input.licenseId ||
    !validateCodeChallenge(input.codeChallenge) ||
    !validateBridgeState(input.state) ||
    !validateDevicePublicKey(input.devicePublicKey)
  ) {
    throw new Error("Invalid mobile handoff request");
  }

  const deviceThumbprint = base64UrlSha256(
    Buffer.from(input.devicePublicKey, "base64url"),
  );
  return new EncryptJWT({
    typ: "buddie_mobile_handoff",
    uid: input.userId,
    lid: input.licenseId,
    cch: input.codeChallenge,
    sth: base64UrlSha256(input.state),
    spki: input.devicePublicKey,
    dkt: deviceThumbprint,
  } satisfies HandoffClaims)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(HANDOFF_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + HANDOFF_TTL_SECONDS)
    .setJti(randomBytes(18).toString("base64url"))
    .encrypt(encryptionKey("handoff"));
}

export async function verifyMobileHandoff(token: string): Promise<HandoffClaims | null> {
  try {
    const { payload } = await jwtDecrypt(token, encryptionKey("handoff"), {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
      issuer: ISSUER,
      audience: HANDOFF_AUDIENCE,
      clockTolerance: 15,
    });
    if (
      payload.typ !== "buddie_mobile_handoff" ||
      typeof payload.uid !== "string" ||
      typeof payload.lid !== "string" ||
      typeof payload.cch !== "string" ||
      typeof payload.sth !== "string" ||
      typeof payload.spki !== "string" ||
      typeof payload.dkt !== "string" ||
      !validateDevicePublicKey(payload.spki)
    ) {
      return null;
    }
    return payload as HandoffClaims;
  } catch {
    return null;
  }
}

export async function issueMobileRefresh(input: {
  userId: string;
  licenseId: string;
  credentialVersion: string;
  devicePublicKey: string;
}): Promise<{ token: string; expiresAt: number }> {
  if (!validateDevicePublicKey(input.devicePublicKey)) {
    throw new Error("Invalid mobile device key");
  }
  const expiresAt = Math.floor(Date.now() / 1000) + REFRESH_TTL_SECONDS;
  const token = await new EncryptJWT({
    typ: "buddie_mobile_refresh",
    uid: input.userId,
    lid: input.licenseId,
    cv: input.credentialVersion,
    spki: input.devicePublicKey,
    dkt: base64UrlSha256(Buffer.from(input.devicePublicKey, "base64url")),
  } satisfies RefreshClaims)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(REFRESH_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setJti(randomBytes(18).toString("base64url"))
    .encrypt(encryptionKey("refresh"));
  return { token, expiresAt: expiresAt * 1000 };
}

export async function verifyMobileRefresh(token: string): Promise<RefreshClaims | null> {
  try {
    const { payload } = await jwtDecrypt(token, encryptionKey("refresh"), {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
      issuer: ISSUER,
      audience: REFRESH_AUDIENCE,
      clockTolerance: 15,
    });
    if (
      payload.typ !== "buddie_mobile_refresh" ||
      typeof payload.uid !== "string" ||
      typeof payload.lid !== "string" ||
      typeof payload.cv !== "string" ||
      typeof payload.spki !== "string" ||
      typeof payload.dkt !== "string" ||
      !validateDevicePublicKey(payload.spki)
    ) {
      return null;
    }
    return payload as RefreshClaims;
  } catch {
    return null;
  }
}
