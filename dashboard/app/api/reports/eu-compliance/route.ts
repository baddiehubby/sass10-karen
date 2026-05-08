import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TRACKED_MOODS = ["neutral", "happy", "thinking", "concerned", "excited", "sleepy", "angry"] as const;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { licenseId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const licenses = await prisma.license.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, key: true, createdAt: true },
  });
  if (!licenses.length) return NextResponse.json({ error: "No license found" }, { status: 404 });

  const targetLicense =
    (body.licenseId && licenses.find((license) => license.id === body.licenseId)) || licenses[0];
  if (!targetLicense) return NextResponse.json({ error: "License not found" }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { companyName: true, name: true, email: true },
  });

  const rangeEnd = new Date();
  const rangeStart = new Date(rangeEnd);
  rangeStart.setDate(rangeStart.getDate() - 30);

  const [events, acknowledgedConcerning] = await Promise.all([
    prisma.moodEvent.findMany({
      where: {
        licenseId: targetLicense.id,
        timestamp: { gte: rangeStart, lte: rangeEnd },
      },
      select: { mood: true, timestamp: true, acknowledgedAt: true },
    }),
    prisma.moodEvent.count({
      where: {
        licenseId: targetLicense.id,
        mood: { in: ["concerned", "angry"] },
        acknowledgedAt: { not: null },
        timestamp: { gte: rangeStart, lte: rangeEnd },
      },
    }),
  ]);

  const moodDistribution = Object.fromEntries(TRACKED_MOODS.map((mood) => [mood, 0])) as Record<string, number>;
  for (const event of events) moodDistribution[event.mood] = (moodDistribution[event.mood] || 0) + 1;

  const reportData = {
    companyName: user?.companyName || user?.name || user?.email || "Unknown Company",
    licenseKey: targetLicense.key,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    totalConversationsAnalyzed: events.length,
    moodDistribution,
    acknowledgedConcerningEvents: acknowledgedConcerning,
  };

  await prisma.complianceReport.create({
    data: {
      licenseId: targetLicense.id,
      data: JSON.stringify(reportData),
    },
  });

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 18;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 34, "F");
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(16);
  doc.text("Buddy AI", 14, y);
  y += 8;
  doc.setFontSize(11);
  doc.text("EU AI Act Supporting Compliance Report", 14, y);
  y += 12;

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(`Company: ${reportData.companyName}`, 14, y);
  y += 7;
  doc.text(`License key: ${reportData.licenseKey}`, 14, y);
  y += 7;
  doc.text(`Date range: ${new Date(reportData.rangeStart).toLocaleDateString()} to ${new Date(reportData.rangeEnd).toLocaleDateString()}`, 14, y);
  y += 7;
  doc.text(`Total conversations analyzed: ${reportData.totalConversationsAnalyzed}`, 14, y);
  y += 7;
  doc.text(`Concerning events acknowledged by a human: ${reportData.acknowledgedConcerningEvents}`, 14, y);
  y += 10;

  doc.setFontSize(12);
  doc.text("Mood distribution", 14, y);
  y += 7;
  doc.setFontSize(10);
  for (const mood of TRACKED_MOODS) {
    doc.text(`${mood}: ${reportData.moodDistribution[mood] || 0}`, 16, y);
    y += 6;
  }

  y += 4;
  doc.setFontSize(11);
  doc.text("EU AI Act mapping statement", 14, y);
  y += 7;
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(
    "This report supports transparency (Article 52) through mood logging, risk monitoring (Article 9) through concerning sentiment detection, and human oversight (Article 14) via acknowledgment records.",
    180,
  );
  doc.text(lines, 14, y);
  y += lines.length * 5 + 6;
  const disclaimer = doc.splitTextToSize(
    "Disclaimer: This report is a supporting document and does not constitute legal certification. Full conformity with the EU AI Act remains the provider's responsibility.",
    180,
  );
  doc.text(disclaimer, 14, y);

  const pdf = doc.output("arraybuffer");
  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="buddy-eu-compliance-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
