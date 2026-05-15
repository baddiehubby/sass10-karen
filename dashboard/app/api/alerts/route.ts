import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { parseQuery } from "@/lib/api-json";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { alertsQuerySchema } from "@/lib/validation";

const CONCERNING_MOODS = ["concerned", "angry"];

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = parseQuery(req, alertsQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { includeAcknowledged, take } = parsed.data;

  const events = await prisma.moodEvent.findMany({
    where: {
      license: { userId: session.user.id },
      mood: { in: CONCERNING_MOODS },
      ...(includeAcknowledged ? {} : { acknowledgedAt: null }),
    },
    orderBy: { timestamp: "desc" },
    take,
    select: {
      id: true,
      mood: true,
      timestamp: true,
      domain: true,
      messageSnippet: true,
      acknowledgedAt: true,
      acknowledgedBy: true,
      licenseId: true,
      license: { select: { key: true } },
    },
  });

  return NextResponse.json({
    events: events.map((event) => ({
      id: event.id,
      mood: event.mood,
      timestamp: event.timestamp,
      domain: event.domain,
      messageSnippet: event.messageSnippet,
      acknowledgedAt: event.acknowledgedAt,
      acknowledgedBy: event.acknowledgedBy,
      licenseId: event.licenseId,
      licenseKeyTail: event.license.key.slice(-8),
    })),
  });
}
