import { getServerSession } from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { isLicenseActive } from "@/lib/free-license";
import { assertLicenseDomainFromRequest } from "@/lib/license-domain";
import type { BuddyMood } from "@/lib/mood-detection";
import { prisma } from "@/lib/prisma";
import {
  applyMoodUpdate,
  createDefaultPresenceState,
  normalizePresenceState,
  parsePresenceJson,
  serializePresenceState,
  type PresenceState,
} from "@/lib/presence-state";

export async function resolveLicenseByKey(licenseKey: string) {
  const key = licenseKey.trim();
  if (!key) return null;
  const license = await prisma.license.findUnique({
    where: { key },
    include: { user: { select: { companionName: true } } },
  });
  if (!license || !isLicenseActive(license)) return null;
  return license;
}

export async function assertLicenseAccess(
  req: NextRequest,
  licenseKey: string,
  options?: { readOnly?: boolean },
) {
  const license = await resolveLicenseByKey(licenseKey);
  if (!license) return { ok: false as const, status: 404, error: "License not found" };

  // Bound licenses must present matching Origin/Referer (or matching claim)
  const domainCheck = assertLicenseDomainFromRequest(license.domain, req);
  if (!domainCheck.ok) {
    return { ok: false as const, status: 403, error: "Domain not allowed" };
  }

  if (options?.readOnly) {
    return { ok: true as const, license };
  }

  const session = await getServerSession(authOptions);
  if (session?.user?.id && session.user.id === license.userId) {
    return { ok: true as const, license };
  }

  // Companion / overlay writes: require matching secret key in header AND body.
  const headerKey = req.headers.get("x-buddy-license-key")?.trim();
  const bodyKey = licenseKey.trim();
  if (headerKey && bodyKey && headerKey === bodyKey && headerKey.length >= 16) {
    return { ok: true as const, license };
  }

  return { ok: false as const, status: 403, error: "Forbidden" };
}

function rowToState(licenseKey: string, row: {
  currentMood: string;
  moodHistory: string;
  lastCheckIn: Date;
  guidanceQueue: string;
  companionName: string;
}): PresenceState {
  const parsed = parsePresenceJson(
    JSON.stringify({
      licenseKey,
      currentMood: row.currentMood,
      moodHistory: JSON.parse(row.moodHistory || "[]"),
      lastCheckIn: row.lastCheckIn.toISOString(),
      guidanceQueue: JSON.parse(row.guidanceQueue || "[]"),
      companionName: row.companionName,
    }),
  );
  return parsed ?? createDefaultPresenceState(licenseKey, row.companionName);
}

export async function getPresenceForLicense(licenseKey: string): Promise<PresenceState | null> {
  const license = await resolveLicenseByKey(licenseKey);
  if (!license) return null;

  const row = await prisma.companionPresence.findUnique({ where: { licenseId: license.id } });
  if (!row) {
    return createDefaultPresenceState(
      licenseKey,
      license.user?.companionName?.trim() || "Buddy",
    );
  }
  return rowToState(licenseKey, row);
}

export async function upsertPresenceState(state: PresenceState): Promise<PresenceState> {
  const license = await resolveLicenseByKey(state.licenseKey);
  if (!license) throw new Error("License not found");

  const normalized = normalizePresenceState(state);
  await prisma.companionPresence.upsert({
    where: { licenseId: license.id },
    create: {
      licenseId: license.id,
      currentMood: normalized.currentMood,
      moodHistory: JSON.stringify(normalized.moodHistory),
      lastCheckIn: new Date(normalized.lastCheckIn),
      guidanceQueue: JSON.stringify(normalized.guidanceQueue),
      companionName: normalized.companionName,
    },
    update: {
      currentMood: normalized.currentMood,
      moodHistory: JSON.stringify(normalized.moodHistory),
      lastCheckIn: new Date(normalized.lastCheckIn),
      guidanceQueue: JSON.stringify(normalized.guidanceQueue),
      companionName: normalized.companionName,
    },
  });
  return normalized;
}

export async function patchPresenceMood(
  licenseKey: string,
  mood: BuddyMood,
  guidanceText?: string,
): Promise<PresenceState | null> {
  const existing = (await getPresenceForLicense(licenseKey)) ?? createDefaultPresenceState(licenseKey);
  const next = applyMoodUpdate(existing, mood, guidanceText ? { guidanceText } : undefined);
  return upsertPresenceState(next);
}

export function presenceToDiskJson(state: PresenceState): string {
  return serializePresenceState(state);
}
