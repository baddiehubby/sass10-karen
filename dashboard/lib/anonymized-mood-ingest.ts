import { createHash } from "crypto";
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
  const salt = process.env.EIDATA_HASH_SALT?.trim() || "buddy-eidata-v1-dev-only";
  return createHash("sha256").update(`${salt}:${pseudonymousToken}`, "utf8").digest("hex");
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

export function anonymizedSessionTokenFromLicense(licenseKey: string): string {
  let hash = 2166136261;
  const source = `${licenseKey}:buddy-private-v1`;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `bdy_${(hash >>> 0).toString(16).padStart(8, "0")}`;
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
