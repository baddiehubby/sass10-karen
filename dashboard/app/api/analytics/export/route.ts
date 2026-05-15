import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { parseQuery } from "@/lib/api-json";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyticsExportQuerySchema } from "@/lib/validation";

function csvEscape(s: string) {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseQuery(req, analyticsExportQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { licenseId, format } = parsed.data;

  const license = await prisma.license.findFirst({
    where: { id: licenseId, userId: session.user.id },
  });
  if (!license) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (license.plan !== "agency") {
    return NextResponse.json({ error: "Export available for agency licenses only" }, { status: 403 });
  }

  const events = await prisma.moodEvent.findMany({
    where: { licenseId },
    orderBy: { timestamp: "asc" },
    select: { mood: true, domain: true, timestamp: true, licenseId: true },
  });

  if (format === "json") {
    return NextResponse.json({
      licenseId,
      count: events.length,
      events: events.map((e) => ({
        ...e,
        timestamp: e.timestamp.toISOString(),
      })),
    });
  }

  const header = ["timestamp_iso", "mood", "domain", "license_id"];
  const lines = [
    header.join(","),
    ...events.map((e) =>
      [e.timestamp.toISOString(), e.mood, e.domain ?? "", e.licenseId].map((c) => csvEscape(String(c))).join(","),
    ),
  ];
  const body = lines.join("\r\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mood-analytics-${licenseId.slice(0, 8)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
