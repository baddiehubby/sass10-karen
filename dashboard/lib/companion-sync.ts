import { ensureFreeLicenseForUser, isLicenseActive, isPaidPlan } from "@/lib/free-license";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/site-url";
import { getWidgetScriptUrl } from "@/lib/widget-cdn";
import { normalizeCompanionType } from "@/lib/tenant";

export type CompanionSyncPayload = {
  licenseKey: string;
  plan: string;
  companionName: string;
  personality: string;
  companionType: "buddy" | "sachapandit";
  apiBase: string;
  widgetScriptUrl: string;
  widget: {
    position: string;
    size: string;
    themeMode: string;
    tooltipText: string | null;
    zIndex: number | null;
  };
  syncedAt: string;
};

export async function buildCompanionSyncPayload(userId: string): Promise<CompanionSyncPayload | null> {
  await ensureFreeLicenseForUser(userId);

  const [user, licenses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { companionName: true, personality: true },
    }),
    prisma.license.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const activePaid = licenses.find((l) => isPaidPlan(l.plan) && isLicenseActive(l)) ?? null;
  const freeLicense = licenses.find((l) => l.plan === "free" && isLicenseActive(l)) ?? null;
  const license = activePaid ?? freeLicense ?? licenses[0];
  if (!license) return null;

  let parsedFeatures: Record<string, unknown> = {};
  try {
    parsedFeatures = JSON.parse(license.features || "{}") as Record<string, unknown>;
  } catch {
    parsedFeatures = {};
  }
  const companionType = normalizeCompanionType(parsedFeatures.companionType);

  return {
    licenseKey: license.key,
    plan: license.plan,
    companionName: user?.companionName?.trim() || "Buddy",
    personality: user?.personality?.trim() || "calm",
    companionType,
    apiBase: getAppBaseUrl(),
    widgetScriptUrl: getWidgetScriptUrl(),
    widget: {
      position: license.widgetPosition,
      size: license.widgetSize,
      themeMode: license.widgetThemeMode,
      tooltipText: license.widgetTooltipText,
      zIndex: license.widgetZIndex,
    },
    syncedAt: new Date().toISOString(),
  };
}
