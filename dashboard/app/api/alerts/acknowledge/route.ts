import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-json";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { alertsAckBodySchema } from "@/lib/validation";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(req, alertsAckBodySchema);
  if (!parsed.ok) return parsed.response;

  const { eventId } = parsed.data;

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
