import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { assertDebiopwrAdmin } from "@/lib/debiopwr-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!assertDebiopwrAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days") || "30")));
  const format = (req.nextUrl.searchParams.get("format") || "csv").toLowerCase();
  const moodFilter = req.nextUrl.searchParams.get("mood")?.trim() || "";
  const regionFilter = req.nextUrl.searchParams.get("region")?.trim() || "";
  const sourceFilter = req.nextUrl.searchParams.get("source")?.trim() || "";

  const since = new Date();
  since.setDate(since.getDate() - days);

  const where: {
    timestamp: { gte: Date };
    mood?: string;
    region?: string;
    source?: string;
  } = { timestamp: { gte: since } };
  if (moodFilter) where.mood = moodFilter;
  if (regionFilter) where.region = regionFilter;
  if (sourceFilter) where.source = sourceFilter;

  const rows = await prisma.anonymizedMoodEvent.groupBy({
    by: ["mood", "region", "source", "companionType"],
    where,
    _count: { _all: true },
  });

  const filtered = rows.filter((r) => r._count._all >= 5);

  if (format === "json") {
    return NextResponse.json({
      ok: true,
      days,
      rows: filtered.map((r) => ({
        mood: r.mood,
        region: r.region,
        source: r.source,
        companionType: r.companionType,
        eventCount: r._count._all,
      })),
    });
  }

  const header = "mood,region,source,companion_type,event_count\n";
  const body = filtered
    .map(
      (r) =>
        `${r.mood},${r.region ?? ""},${r.source ?? ""},${r.companionType ?? "buddy"},${r._count._all}`,
    )
    .join("\n");

  return new NextResponse(header + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="debiopwr-export-${days}d.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
