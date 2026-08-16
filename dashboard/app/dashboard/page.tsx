import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { BuddieHome } from "@/components/buddie-home";
import { getServerBillingSnapshot } from "@/lib/billing/entitlement";
import { daysSince } from "@/lib/dashboard-format";
import { ensureFreeLicenseForUser, isLicenseActive, isPaidPlan } from "@/lib/free-license";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/site-url";
import { getWidgetScriptUrl } from "@/lib/widget-cdn";
import { brandingFromHostname } from "@/lib/tenant-brand";
import { TENANT_CONFIGS } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const host = headers().get("host");
  const branding = brandingFromHostname(host);

  let userId = session.user.id;
  if (!userId && session.user.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { id: true },
    });
    userId = byEmail?.id ?? "";
  }
  if (!userId) redirect("/login");

  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { companionName: true, createdAt: true, onboardingCompleted: true },
  });

  if (!userRow?.onboardingCompleted) {
    redirect("/onboarding");
  }

  await ensureFreeLicenseForUser(userId);

  const companionName = userRow.companionName?.trim() || branding.shortName || "Buddie";

  const licenses = await prisma.license.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  const licenseIds = licenses.map((l) => l.id);

  const billing = await getServerBillingSnapshot(userId);
  const activePaidLicense = licenses.find((l) => isPaidPlan(l.plan) && isLicenseActive(l)) || null;
  const freeLicense = licenses.find((l) => l.plan === "free" && isLicenseActive(l)) || null;
  const orbLicense = activePaidLicense ?? freeLicense;
  const isSacredDay = billing.entitlements.requiresSubscription;
  const subscriptionLabel = billing.subscriptionLabel;
  const portalUrl = billing.portalUrl ?? activePaidLicense?.lemonSqueezyCustomerPortalUrl ?? null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todaysMoods =
    licenseIds.length === 0
      ? []
      : await prisma.moodEvent.findMany({
          where: { licenseId: { in: licenseIds }, timestamp: { gte: todayStart } },
          select: { mood: true },
        });

  const moodTally: Record<string, number> = {};
  for (const row of todaysMoods) {
    moodTally[row.mood] = (moodTally[row.mood] || 0) + 1;
  }
  const topMood = Object.entries(moodTally).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const anchorDate = licenses[0]?.createdAt ?? userRow.createdAt ?? new Date();
  const daysTogether = daysSince(anchorDate);

  return (
    <BuddieHome
      companionName={companionName}
      topMood={topMood}
      daysTogether={daysTogether}
      licenseKey={orbLicense?.key ?? null}
      scriptUrl={getWidgetScriptUrl()}
      apiBase={getAppBaseUrl()}
      isSacredDay={isSacredDay}
      subscriptionLabel={subscriptionLabel}
      portalUrl={portalUrl}
      holyMusicEnabled={TENANT_CONFIGS[branding.tenant].features.holyMusic}
    />
  );
}
