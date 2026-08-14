import { generateLicenseKey } from "@/lib/license";
import { prisma } from "@/lib/prisma";

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

export function isLicenseActive(license: { expiresAt: Date; plan: string }): boolean {
  if (license.plan.trim().toLowerCase() === "free") return true;
  return license.expiresAt.getTime() > Date.now();
}

/** Creates a perpetual free license if the user has none yet. */
export async function ensureFreeLicenseForUser(userId: string): Promise<void> {
  const existing = await prisma.license.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (existing) return;

  await prisma.license.create({
    data: {
      key: generateLicenseKey(),
      userId,
      plan: "free",
      features: JSON.stringify(FREE_LICENSE_FEATURES),
      expiresAt: FREE_PERPETUAL_EXPIRY,
      activatedAt: new Date(),
    },
  });
}

export function displayPlanName(plan: string): string {
  const p = plan.trim().toLowerCase();
  if (p === "free") return "Buddy account";
  if (p === "starter") return "Starter";
  if (p === "pro" || p === "growth") return "Pro";
  if (p === "premium" || p === "agency") return "Premium";
  if (p === "enterprise") return "Enterprise";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
