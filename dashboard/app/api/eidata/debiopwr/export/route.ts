import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function assertDebiopwrAdmin(session: { user?: { email?: string | null } } | null) {
  const email = (session?.user?.email || "").toLowerCase();
  const adminList = (process.env.BUDDY_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email && adminList.includes(email));
}

/** Export k-anonymized mood dataset (no session tokens in export — aggregated buckets only). */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!assertDebiopwrAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days") || "30")));
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await prisma.anonymizedMoodEvent.groupBy({
    by: ["mood", "region", "source", "companionType"],
    where: { timestamp: { gte: since } },
    _count: { _all: true },
  });

  const header = "mood,region,source,companion_type,event_count\n";
  const body = rows
    .filter((r) => r._count._all >= 5)
    .map(
      (r) =>
        `${r.mood},${r.region ?? ""},${r.source ?? ""},${r.companionType ?? "buddy"},${r._count._all}`,
    )
    .join("\n");

  const csv = header + body;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="debiopwr-mood-aggregate-${days}d.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
