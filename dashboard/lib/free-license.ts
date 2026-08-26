import { generateLicenseKey } from "@/lib/license";
import { prisma } from "@/lib/prisma";

import { lemonStatusGrantsAccess } from "@/lib/subscription-entitlement";

/** Perpetual free tier — schema requires DateTime; far-future date means never expires. */
export const FREE_PERPETUAL_EXPIRY = new Date("2099-12-31T23:59:59.999Z");

export const FREE_LICENSE_FEATURES = {
  basicMoodDetection: true,
  basicMemory: true,
  watermark: true,
} as const;

const PAID_PLANS = new Set(["starter", "pro", "premium", "agency", "enterprise"]);

export function isPaidPlan(plan: string): boolean {
  return PAID_PLANS.has(plan.trim().toLowerCase());
}

/**
 * Server-authoritative active check.
 * Paid plans require unexpired date AND a Lemon status that still grants access.
 * Missing Lemon status on a paid plan does NOT grant access (no billing bypass).
 * Sacred Day / free is always active as account bootstrap.
 */
export function isLicenseActive(license: {
  expiresAt: Date;
  plan: string;
  lemonSqueezySubscriptionStatus?: string | null;
}): boolean {
  if (license.plan.trim().toLowerCase() === "free") return true;
  if (license.expiresAt.getTime() <= Date.now()) return false;
  if (!license.lemonSqueezySubscriptionStatus) return false;
  return lemonStatusGrantsAccess(license.lemonSqueezySubscriptionStatus);
}

function isMissingWidgetSessionTokenColumn(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybe = err as {
    code?: string;
    meta?: { column?: string };
    message?: string;
  };
  return (
    maybe.code === "P2022" &&
    (maybe.meta?.column === "License.widgetSessionToken" ||
      String(maybe.message || "").includes("License.widgetSessionToken"))
  );
}

let widgetSessionColumnEnsure: Promise<void> | null = null;

function ensureWidgetSessionTokenColumn(): Promise<void> {
  if (!widgetSessionColumnEnsure) {
    widgetSessionColumnEnsure = (async () => {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "License" ADD COLUMN IF NOT EXISTS "widgetSessionToken" TEXT`,
        );
      } catch {
        widgetSessionColumnEnsure = null;
      }
    })();
  }
  return widgetSessionColumnEnsure;
}

/** Creates a perpetual free (Sacred Day) license if the user has none yet. */
export function ensureFreeLicenseForUser(userId: string): Promise<void> {
  return ensureSacredDayLicenseForUser(userId);
}

export async function ensureSacredDayLicenseForUser(userId: string): Promise<void> {
  await ensureWidgetSessionTokenColumn();

  const existing = await prisma.license.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (existing) return;

  const key = generateLicenseKey();
  // widgetSessionToken is minted server-side on first verify/auth (see anonymized-mood-ingest).
  // Do not import HMAC minting here — that module must stay out of the client graph.
  try {
    await prisma.license.create({
      data: {
        key,
        userId,
        plan: "free",
        features: JSON.stringify(FREE_LICENSE_FEATURES),
        expiresAt: FREE_PERPETUAL_EXPIRY,
        activatedAt: new Date(),
        lemonSqueezySubscriptionStatus: "free",
      },
      // Narrow return — default SELECT * fails with P2022 if widgetSessionToken is missing.
      select: { id: true },
    });
  } catch (err) {
    if (!isMissingWidgetSessionTokenColumn(err)) throw err;
    const id = `c${cryptoRandomId()}`;
    await prisma.$executeRaw`
      INSERT INTO "License" ("id", "key", "userId", "features", "plan", "expiresAt", "activatedAt", "lemonSqueezySubscriptionStatus", "widgetPosition", "widgetSize", "widgetThemeMode", "themePreset", "createdAt", "updatedAt")
      VALUES (
        ${id},
        ${key},
        ${userId},
        ${JSON.stringify(FREE_LICENSE_FEATURES)},
        ${"free"},
        ${FREE_PERPETUAL_EXPIRY},
        ${new Date()},
        ${"free"},
        ${"bottom-right"},
        ${"medium"},
        ${"auto"},
        ${"default"},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
  }
}

function cryptoRandomId(): string {
  // Local helper avoids importing crypto in a module that may be pulled near client boundaries.
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

export function displayPlanName(plan: string): string {
  const p = plan.trim().toLowerCase();
  if (p === "free") return "Sacred Day";
  if (p === "starter") return "Starter";
  if (p === "pro" || p === "growth") return "Pro";
  if (p === "premium" || p === "agency") return "Premium";
  if (p === "enterprise") return "Enterprise";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
