/**
 * Short-lived scoped widget credentials.
 * Static license keys may bootstrap an exchange only — they must not be
 * permanent write authentication when unbound.
 */

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const WIDGET_CREDENTIAL_TTL_SEC = 15 * 60; // 15 minutes
export const WIDGET_SCOPES = ["mood:write", "presence:write", "analytics:write", "theme:read"] as const;
export type WidgetScope = (typeof WIDGET_SCOPES)[number];

export type WidgetCredentialClaims = {
  lid: string;
  scopes: WidgetScope[];
  kfp: string;
  typ: "buddy_widget";
};

function secretKey(): Uint8Array {
  const secret =
    process.env.EIDATA_HASH_SALT?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "buddy-dev-widget-cred");
  if (!secret) {
    throw new Error("EIDATA_HASH_SALT or NEXTAUTH_SECRET required for widget credentials");
  }
  return new TextEncoder().encode(secret);
}

/** Fingerprint of the current license key — rotates when the key rotates. */
export function licenseKeyFingerprint(licenseKey: string): string {
  return createHash("sha256").update(`buddy-key-fp:v1:${licenseKey}`, "utf8").digest("hex").slice(0, 16);
}

export async function mintWidgetCredential(input: {
  licenseId: string;
  licenseKey: string;
  scopes: WidgetScope[];
  ttlSec?: number;
}): Promise<{ token: string; expiresAt: number; scopes: WidgetScope[] }> {
  const scopes = input.scopes.filter((s): s is WidgetScope =>
    (WIDGET_SCOPES as readonly string[]).includes(s),
  );
  if (!scopes.length) throw new Error("at least one widget scope required");
  const ttl = Math.min(Math.max(input.ttlSec ?? WIDGET_CREDENTIAL_TTL_SEC, 60), 60 * 60);
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const token = await new SignJWT({
    lid: input.licenseId,
    scopes,
    kfp: licenseKeyFingerprint(input.licenseKey),
    typ: "buddy_widget",
  } satisfies WidgetCredentialClaims & JWTPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setJti(createHash("sha256").update(`${input.licenseId}:${expiresAt}:${Math.random()}`).digest("hex").slice(0, 24))
    .sign(secretKey());
  return { token, expiresAt: expiresAt * 1000, scopes };
}

export type VerifiedWidgetCredential = {
  licenseId: string;
  scopes: WidgetScope[];
  keyFingerprint: string;
  expiresAt: number;
  jti: string;
};

export async function verifyWidgetCredential(
  token: string,
  opts?: { requiredScope?: WidgetScope },
): Promise<VerifiedWidgetCredential | null> {
  const raw = (token || "").trim();
  if (!raw || raw.split(".").length !== 3) return null;
  try {
    const { payload } = await jwtVerify(raw, secretKey(), {
      algorithms: ["HS256"],
      clockTolerance: 30,
    });
    if (payload.typ !== "buddy_widget") return null;
    const lid = typeof payload.lid === "string" ? payload.lid : "";
    const kfp = typeof payload.kfp === "string" ? payload.kfp : "";
    const scopes = Array.isArray(payload.scopes)
      ? payload.scopes.filter((s): s is WidgetScope => typeof s === "string" && (WIDGET_SCOPES as readonly string[]).includes(s))
      : [];
    if (!lid || !kfp || !scopes.length) return null;
    if (opts?.requiredScope && !scopes.includes(opts.requiredScope)) return null;
    const exp = typeof payload.exp === "number" ? payload.exp * 1000 : 0;
    if (!exp || exp <= Date.now()) return null;
    return {
      licenseId: lid,
      scopes,
      keyFingerprint: kfp,
      expiresAt: exp,
      jti: typeof payload.jti === "string" ? payload.jti : "",
    };
  } catch {
    return null;
  }
}

/**
 * Unbound static keys must not authorize writes forever.
 * Bound domains or short-lived credentials are acceptable.
 */
export function staticLicenseKeyWriteAllowed(licenseDomain: string | null | undefined): boolean {
  return Boolean((licenseDomain || "").trim());
}

/** Timing-safe secret compare for ops tokens. */
export function timingSafeSecretEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) {
    // Still compare to reduce timing oracle on length (constant dummy).
    const dig = createHmac("sha256", "len").update(a).digest();
    timingSafeEqual(dig, dig);
    return false;
  }
  return timingSafeEqual(aa, bb);
}
