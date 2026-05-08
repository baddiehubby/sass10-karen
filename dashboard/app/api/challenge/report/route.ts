import { NextResponse } from "next/server";
import { buildChallengeReportPayload, renderChallengeReportPdf } from "@/lib/challenge-report-pdf";
import { CHALLENGE_SAMPLE_MOOD_COUNTS } from "@/lib/challenge-sample";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const licenseId = url.searchParams.get("licenseId")?.trim();
  const mode = url.searchParams.get("mode")?.trim();
  const session = await getServerSession(authOptions);

  let companionName = "Buddy";
  let moodCounts: Record<string, number> = CHALLENGE_SAMPLE_MOOD_COUNTS;
  let usingDemo = true;

  if (session?.user?.id && licenseId) {
    const license = await prisma.license.findFirst({
      where: { id: licenseId, userId: session.user.id },
      select: { id: true },
    });
    if (license) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { companionName: true },
      });

      companionName = user?.companionName?.trim() || "Buddy";
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const rows = await prisma.moodEvent.groupBy({
        by: ["mood"],
        where: { licenseId, timestamp: { gte: weekAgo } },
        _count: { mood: true },
      });
      const realCounts: Record<string, number> = {};
      for (const r of rows) {
        realCounts[r.mood] = r._count.mood;
      }
      if (Object.keys(realCounts).length > 0) {
        moodCounts = realCounts;
      }
      usingDemo = false;
    }
  }

  const payload = buildChallengeReportPayload(moodCounts, companionName);

  if (mode === "json") {
    return NextResponse.json({
      ok: true,
      usingDemo,
      headlineMood: payload.headlineMood,
      downloadUrl: `/api/challenge/report${licenseId ? `?licenseId=${encodeURIComponent(licenseId)}` : ""}`,
    });
  }

  const buf = await renderChallengeReportPdf(payload);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="buddie-challenge-report.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
