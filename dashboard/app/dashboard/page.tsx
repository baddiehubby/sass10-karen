import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardHome } from "@/components/dashboard-home";
import { daysSince } from "@/lib/dashboard-format";
import { ensureFreeLicenseForUser, isLicenseActive, isPaidPlan } from "@/lib/free-license";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/site-url";
import { getWidgetScriptUrl } from "@/lib/widget-cdn";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  let userId = session.user.id;
  if (!userId && session.user.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { id: true, createdAt: true },
    });
    userId = byEmail?.id ?? "";
  }
  if (!userId) redirect("/login");

  await ensureFreeLicenseForUser(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companionName: true, createdAt: true },
  });
  const companionName = user?.companionName?.trim() || "Buddy";

  const licenses = await prisma.license.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  const licenseIds = licenses.map((l) => l.id);

  const activePaidLicense = licenses.find((l) => isPaidPlan(l.plan) && isLicenseActive(l)) || null;
  const freeLicense = licenses.find((l) => l.plan === "free" && isLicenseActive(l)) || null;
  const orbLicense = activePaidLicense ?? freeLicense;
  const isFreeOnly = !activePaidLicense && Boolean(freeLicense);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [weekEvents, recentEvents, todaysMoods] =
    licenseIds.length === 0
      ? [[], [], [] as { mood: string }[]]
      : await Promise.all([
          prisma.moodEvent.findMany({
            where: { licenseId: { in: licenseIds }, timestamp: { gte: weekAgo } },
            orderBy: { timestamp: "asc" },
            select: { mood: true, timestamp: true },
          }),
          prisma.moodEvent.findMany({
            where: { licenseId: { in: licenseIds } },
            orderBy: { timestamp: "desc" },
            take: 5,
            select: { id: true, mood: true, domain: true, timestamp: true },
          }),
          prisma.moodEvent.findMany({
            where: { licenseId: { in: licenseIds }, timestamp: { gte: todayStart } },
            select: { mood: true },
          }),
        ]);

  const moodTally: Record<string, number> = {};
  for (const row of todaysMoods) {
    moodTally[row.mood] = (moodTally[row.mood] || 0) + 1;
  }
  const topMood =
    Object.entries(moodTally).sort((a, b) => b[1] - a[1])[0]?.[0] || (recentEvents.length ? "neutral" : "—");

  const anchorDate = licenses[0]?.createdAt ?? user?.createdAt ?? new Date();
  const daysTogether = daysSince(anchorDate);

  const widgetScriptUrl = getWidgetScriptUrl();
  const apiBase = getAppBaseUrl();

  return (
    <DashboardHome
      companionName={companionName}
      topMood={topMood}
      daysTogether={daysTogether}
      licenseKey={orbLicense?.key ?? null}
      scriptUrl={widgetScriptUrl}
      apiBase={apiBase}
      sparklineEvents={weekEvents.map((e) => ({
        mood: e.mood,
        timestamp: e.timestamp.toISOString(),
      }))}
      recentMoments={recentEvents.map((e) => ({
        id: e.id,
        mood: e.mood,
        domain: e.domain,
        timestamp: e.timestamp.toISOString(),
      }))}
      hasLicense={Boolean(orbLicense)}
      isFreeOnly={isFreeOnly}
    />
  );
}
