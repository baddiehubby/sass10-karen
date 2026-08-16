import { createHash, createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
  "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
]);

const ASIA_COUNTRIES = new Set([
  "CN", "JP", "KR", "IN", "SG", "HK", "TW", "TH", "VN", "MY", "ID", "PH", "PK", "BD", "AE", "SA", "IL",
]);

export type BroadRegion = "EU" | "US" | "Asia" | "Other";

export function hashSessionTokenForStorage(pseudonymousToken: string): string {
  const salt = process.env.EIDATA_HASH_SALT?.trim();
  if (!salt) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EIDATA_HASH_SALT is required in production");
    }
    return createHash("sha256").update(`buddy-eidata-v1-dev-only:${pseudonymousToken}`, "utf8").digest("hex");
  }
  return createHash("sha256").update(`${salt}:${pseudonymousToken}`, "utf8").digest("hex");
}

/**
 * Stable widget session token derived from license key (HMAC, 128-bit hex).
 * Never reverse to the license key; lookup requires licenseKey or indexed token column.
 */
export function anonymizedSessionTokenFromLicense(licenseKey: string): string {
  const secret =
    process.env.EIDATA_HASH_SALT?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "buddy-dev-session-hmac");
  if (!secret) {
    throw new Error("EIDATA_HASH_SALT or NEXTAUTH_SECRET required to mint session tokens");
  }
  const digest = createHmac("sha256", secret).update(`buddy-widget-session:v2:${licenseKey}`, "utf8").digest("hex");
  return `bdy_${digest.slice(0, 32)}`;
}

/** Resolve license by key, or by exact session token without scanning all licenses. */
export async function resolveLicenseForWidgetAuth(input: {
  licenseKey?: string | null;
  sessionToken?: string | null;
}): Promise<{ id: string; key: string; userId: string; expiresAt: Date; plan: string; lemonSqueezySubscriptionStatus: string | null } | null> {
  const key = (input.licenseKey || "").trim();
  if (key) {
    return prisma.license.findUnique({
      where: { key },
      select: {
        id: true,
        key: true,
        userId: true,
        expiresAt: true,
        plan: true,
        lemonSqueezySubscriptionStatus: true,
      },
    });
  }

  const token = (input.sessionToken || "").trim();
  if (!token || !token.startsWith("bdy_")) return null;

  // Indexed path when column is populated; fallback is bounded recent licenses only (not full table).
  const withToken = await prisma.license.findFirst({
    where: { widgetSessionToken: token, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      key: true,
      userId: true,
      expiresAt: true,
      plan: true,
      lemonSqueezySubscriptionStatus: true,
    },
  });
  if (withToken) return withToken;

  // Legacy tokens: check a capped set of recently updated licenses (avoid full-table scan).
  const recent = await prisma.license.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      key: true,
      userId: true,
      expiresAt: true,
      plan: true,
      lemonSqueezySubscriptionStatus: true,
    },
  });
  const match = recent.find((l) => {
    try {
      return anonymizedSessionTokenFromLicense(l.key) === token;
    } catch {
      return false;
    }
  });
  if (!match) return null;

  // Backfill indexed token for next lookup
  try {
    await prisma.license.update({
      where: { id: match.id },
      data: { widgetSessionToken: token },
    });
  } catch {
    /* column may be missing until db push — ignore */
  }
  return match;
}

export function broadRegionFromCountryCode(code: string | null | undefined): BroadRegion {
  const cc = (code || "").trim().toUpperCase();
  if (!cc) return "Other";
  if (cc === "US") return "US";
  if (EU_COUNTRIES.has(cc)) return "EU";
  if (ASIA_COUNTRIES.has(cc)) return "Asia";
  return "Other";
}

export function broadRegionFromRequest(req: Request): BroadRegion {
  const cf = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country");
  if (cf) return broadRegionFromCountryCode(cf);
  const accept = (req.headers.get("accept-language") || "").toLowerCase();
  if (accept.includes("zh") || accept.includes("ja") || accept.includes("ko")) return "Asia";
  if (accept.includes("en-us")) return "US";
  return "Other";
}

export function sourceFromDomain(domain: string | null | undefined): string {
  const d = (domain || "").toLowerCase();
  if (d.includes("chatgpt") || d.includes("openai")) return "chatgpt";
  if (d.includes("claude")) return "claude";
  if (d.includes("gemini") || d.includes("google")) return "gemini";
  if (d.includes("buddieai")) return "website";
  return domain ? "unknown" : "unknown";
}

export async function ingestAnonymizedMoodEvent(input: {
  sessionToken: string;
  mood: string;
  timestamp?: Date;
  region?: BroadRegion;
  companionType?: string;
  source?: string;
}): Promise<void> {
  const storedToken = hashSessionTokenForStorage(input.sessionToken);
  await prisma.anonymizedMoodEvent.create({
    data: {
      sessionToken: storedToken,
      mood: input.mood,
      timestamp: input.timestamp ?? new Date(),
      region: input.region ?? "Other",
      companionType: input.companionType ?? "buddy",
      source: input.source ?? "unknown",
    },
  });
}
