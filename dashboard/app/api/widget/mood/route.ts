import { NextResponse } from "next/server";
import { parseJsonBody, parseQuery } from "@/lib/api-json";
import { prisma } from "@/lib/prisma";
import { widgetMoodGetQuerySchema, widgetMoodPostSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, widgetMoodPostSchema);
  if (!parsed.ok) return parsed.response;

  const { licenseKey, licenseId, mood } = parsed.data;
  const ttlSeconds = parsed.data.ttlSeconds ?? 60;

  const license = await prisma.license.findFirst({
    where: licenseKey ? { key: licenseKey } : { id: licenseId },
    select: { id: true, expiresAt: true },
  });
  if (!license || license.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invalid license" }, { status: 403 });
  }

  await prisma.license.update({
    where: { id: license.id },
    data: {
      forcedMood: mood,
      forcedMoodUntil: new Date(Date.now() + ttlSeconds * 1000),
    },
  });

  await prisma.collaborativeRoom.upsert({
    where: { licenseId: license.id },
    update: { mood },
    create: { licenseId: license.id, mood },
  });

  return NextResponse.json({ ok: true, mood, ttlSeconds, licenseId: license.id });
}

export async function GET(req: Request) {
  const parsed = parseQuery(req, widgetMoodGetQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { licenseId } = parsed.data;
  const room = await prisma.collaborativeRoom.findUnique({
    where: { licenseId },
    select: { mood: true, updatedAt: true },
  });
  return NextResponse.json({
    mood: room?.mood || "neutral",
    updatedAt: room?.updatedAt || null,
  });
}
