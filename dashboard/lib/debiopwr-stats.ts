import { EIDATA_FLYWHEEL_EVENT_TARGET, flywheelProgressPercent } from "@/lib/eidata-flywheel";
import { prisma } from "@/lib/prisma";

export type DebiopwrSummary = {
  windowDays: number;
  totalEvents: number;
  totalEventsAllTime: number;
  uniqueSessions30d: number;
  flywheelTarget: number;
  flywheelPercent: number;
  last24hEvents: number;
  byMood: Array<{ mood: string; count: number }>;
  byRegion: Array<{ region: string | null; count: number }>;
  bySource: Array<{ source: string | null; count: number }>;
  byCompanionType: Array<{ companionType: string | null; count: number }>;
  dailyActiveSessions: Array<{ date: string; sessions: number }>;
  consentRate: {
    anonymousAnalyticsGrantRate: number;
    modelTrainingGrantRate: number;
    companionGrantRate: number;
    totalUsersWithConsentRows: number;
  };
  topMoodTriggers: Array<{ mood: string; count: number }>;
  consentStats: Array<{ purpose: string; status: string; count: number }>;
};

export async function buildDebiopwrSummary(windowDays = 30): Promise<DebiopwrSummary> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const [
    total,
    totalAllTime,
    uniqueSessions,
    byMood,
    byRegion,
    bySource,
    byCompanionType,
    last24h,
    recentEvents,
    consentStats,
    consentUsers,
  ] = await Promise.all([
    prisma.anonymizedMoodEvent.count({ where: { timestamp: { gte: since } } }),
    prisma.anonymizedMoodEvent.count(),
    prisma.anonymizedMoodEvent.groupBy({
      by: ["sessionToken"],
      where: { timestamp: { gte: since } },
    }),
    prisma.anonymizedMoodEvent.groupBy({
      by: ["mood"],
      where: { timestamp: { gte: since } },
      _count: { mood: true },
    }),
    prisma.anonymizedMoodEvent.groupBy({
      by: ["region"],
      where: { timestamp: { gte: since } },
      _count: { region: true },
    }),
    prisma.anonymizedMoodEvent.groupBy({
      by: ["source"],
      where: { timestamp: { gte: since } },
      _count: { source: true },
    }),
    prisma.anonymizedMoodEvent.groupBy({
      by: ["companionType"],
      where: { timestamp: { gte: since } },
      _count: { companionType: true },
    }),
    prisma.anonymizedMoodEvent.count({
      where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.anonymizedMoodEvent.findMany({
      where: { timestamp: { gte: since } },
      select: { sessionToken: true, timestamp: true },
    }),
    prisma.userConsent.groupBy({
      by: ["purpose", "status"],
      _count: { status: true },
    }),
    prisma.userConsent.groupBy({
      by: ["userId"],
      _count: { userId: true },
    }),
  ]);

  const dayMap = new Map<string, Set<string>>();
  for (const row of recentEvents) {
    const day = row.timestamp.toISOString().slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, new Set());
    dayMap.get(day)!.add(row.sessionToken);
  }
  const dailyActiveSessions = Array.from(dayMap.entries())
    .map(([date, set]) => ({ date, sessions: set.size }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const granted = (purpose: string) =>
    consentStats.find((c) => c.purpose === purpose && c.status === "granted")?._count.status ?? 0;
  const totalUsers = Math.max(1, consentUsers.length);

  return {
    windowDays,
    totalEvents: total,
    totalEventsAllTime: totalAllTime,
    uniqueSessions30d: uniqueSessions.length,
    flywheelTarget: EIDATA_FLYWHEEL_EVENT_TARGET,
    flywheelPercent: flywheelProgressPercent(totalAllTime),
    last24hEvents: last24h,
    byMood: byMood.map((r) => ({ mood: r.mood, count: r._count.mood })),
    byRegion: byRegion.map((r) => ({ region: r.region, count: r._count.region })),
    bySource: bySource.map((r) => ({ source: r.source, count: r._count.source })),
    byCompanionType: byCompanionType.map((r) => ({
      companionType: r.companionType,
      count: r._count.companionType,
    })),
    dailyActiveSessions,
    consentRate: {
      anonymousAnalyticsGrantRate: Math.round((granted("anonymous_analytics") / totalUsers) * 100),
      modelTrainingGrantRate: Math.round((granted("model_training") / totalUsers) * 100),
      companionGrantRate: Math.round((granted("companion_mood_detection") / totalUsers) * 100),
      totalUsersWithConsentRows: consentUsers.length,
    },
    topMoodTriggers: byMood.slice(0, 6).map((r) => ({ mood: r.mood, count: r._count.mood })),
    consentStats: consentStats.map((r) => ({
      purpose: r.purpose,
      status: r.status,
      count: r._count.status,
    })),
  };
}
