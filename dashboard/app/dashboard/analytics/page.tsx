import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAID = new Set(["pro", "premium", "agency"]);

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const licenses = await prisma.license.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, key: true, plan: true },
  });

  const ids = licenses.map((l) => l.id);
  const hasPaidTier = licenses.some((l) => PAID.has(l.plan));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const eventsRaw =
    ids.length === 0
      ? []
      : await prisma.moodEvent.findMany({
          where: { licenseId: { in: ids } },
          orderBy: { timestamp: "desc" },
          take: 5000,
          select: { id: true, mood: true, domain: true, timestamp: true, licenseId: true },
        });

  const eventsFiltered = hasPaidTier
    ? eventsRaw
    : eventsRaw.filter((e) => e.timestamp.getTime() >= cutoff.getTime());

  const hasAgencyExport = licenses.some((l) => l.plan === "agency");

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 pb-16">
      <AnalyticsDashboard
        licenses={licenses.map((l) => ({
          id: l.id,
          plan: l.plan,
          label: `…${l.key.slice(-6)}`,
        }))}
        events={eventsFiltered.map((e) => ({
          id: e.id,
          mood: e.mood,
          domain: e.domain,
          timestamp: e.timestamp.toISOString(),
          licenseId: e.licenseId,
        }))}
        hasAgencyExport={hasAgencyExport}
        limitedHistory={!hasPaidTier}
      />
    </main>
  );
}
