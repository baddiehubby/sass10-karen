import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const licenseId = (url.searchParams.get("licenseId") || "").trim();
  if (!licenseId) return NextResponse.json({ error: "licenseId required" }, { status: 400 });

  const license = await prisma.license.findFirst({
    where: { id: licenseId, userId: session.user.id },
    select: { id: true, key: true, plan: true, domain: true },
  });
  if (!license) return NextResponse.json({ error: "License not found" }, { status: 404 });

  const events = await prisma.moodEvent.findMany({
    where: { licenseId },
    orderBy: { timestamp: "asc" },
    select: {
      id: true,
      mood: true,
      domain: true,
      messageSnippet: true,
      timestamp: true,
      acknowledgedAt: true,
      acknowledgedBy: true,
    },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    license: {
      id: license.id,
      key: license.key,
      plan: license.plan,
      domain: license.domain,
    },
    events,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="buddy-dpia-export-${license.id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
