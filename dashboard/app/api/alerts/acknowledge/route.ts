import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { eventId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = (body.eventId || "").trim();
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const event = await prisma.moodEvent.findUnique({
    where: { id: eventId },
    select: { id: true, license: { select: { userId: true } }, acknowledgedAt: true },
  });

  if (!event || event.license.userId !== session.user.id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.acknowledgedAt) {
    return NextResponse.json({ ok: true, alreadyAcknowledged: true });
  }

  const updated = await prisma.moodEvent.update({
    where: { id: eventId },
    data: {
      acknowledgedAt: new Date(),
      acknowledgedBy: session.user.id,
    },
    select: { id: true, acknowledgedAt: true, acknowledgedBy: true },
  });

  return NextResponse.json({ ok: true, event: updated });
}
