import { prisma } from "@/lib/prisma";
import {
  CONSENT_PURPOSES,
  CONSENT_PURPOSE_META,
  type ConsentPurpose,
  type ConsentStatus,
} from "@/lib/consent-purposes";

export type UserConsentRecord = {
  purpose: ConsentPurpose;
  status: ConsentStatus;
  consentedAt: string;
  updatedAt: string;
  title: string;
  description: string;
  regulations: string[];
};

export async function ensureDefaultConsents(userId: string): Promise<void> {
  const existing = await prisma.userConsent.findMany({
    where: { userId },
    select: { purpose: true },
  });
  const have = new Set(existing.map((r) => r.purpose));
  const missing = CONSENT_PURPOSES.filter((p) => !have.has(p));
  if (missing.length === 0) return;

  await prisma.userConsent.createMany({
    data: missing.map((purpose) => ({
      userId,
      purpose,
      status: CONSENT_PURPOSE_META[purpose].defaultStatus,
    })),
  });
}

export async function getUserConsents(userId: string): Promise<UserConsentRecord[]> {
  await ensureDefaultConsents(userId);
  const rows = await prisma.userConsent.findMany({
    where: { userId },
    orderBy: { purpose: "asc" },
  });

  return CONSENT_PURPOSES.map((purpose) => {
    const row = rows.find((r) => r.purpose === purpose);
    const meta = CONSENT_PURPOSE_META[purpose];
    return {
      purpose,
      status: (row?.status as ConsentStatus) || meta.defaultStatus,
      consentedAt: (row?.consentedAt ?? new Date()).toISOString(),
      updatedAt: (row?.updatedAt ?? new Date()).toISOString(),
      title: meta.title,
      description: meta.description,
      regulations: meta.regulations,
    };
  });
}

export async function hasConsent(userId: string, purpose: ConsentPurpose): Promise<boolean> {
  await ensureDefaultConsents(userId);
  const row = await prisma.userConsent.findUnique({
    where: { userId_purpose: { userId, purpose } },
  });
  return row?.status === "granted";
}

export async function setUserConsent(
  userId: string,
  purpose: ConsentPurpose,
  status: ConsentStatus,
): Promise<UserConsentRecord> {
  await ensureDefaultConsents(userId);
  const now = new Date();
  const row = await prisma.userConsent.upsert({
    where: { userId_purpose: { userId, purpose } },
    create: { userId, purpose, status, consentedAt: now },
    update: { status, updatedAt: now },
  });
  const meta = CONSENT_PURPOSE_META[purpose];
  return {
    purpose,
    status: row.status as ConsentStatus,
    consentedAt: row.consentedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    title: meta.title,
    description: meta.description,
    regulations: meta.regulations,
  };
}

export async function setUserConsentsBulk(
  userId: string,
  updates: Array<{ purpose: ConsentPurpose; status: ConsentStatus }>,
): Promise<UserConsentRecord[]> {
  for (const u of updates) {
    await setUserConsent(userId, u.purpose, u.status);
  }
  return getUserConsents(userId);
}

export async function withdrawUserConsent(userId: string, purpose: ConsentPurpose): Promise<UserConsentRecord> {
  return setUserConsent(userId, purpose, "withdrawn");
}

export async function markEidataConsentCompleted(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { eidataConsentCompleted: true },
  });
}

export async function userHasCompletedEidataConsent(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { eidataConsentCompleted: true },
  });
  return Boolean(user?.eidataConsentCompleted);
}
