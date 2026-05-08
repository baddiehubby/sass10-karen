import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_MOODS = new Set(["neutral", "happy", "thinking", "concerned", "excited", "sleepy", "angry"]);

export async function POST(req: Request) {
  let body: {
    licenseKey?: string;
    licenseId?: string;
    mood?: string;
    ttlSeconds?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const licenseKey = (body.licenseKey || "").trim();
  const licenseId = (body.licenseId || "").trim();
  const mood = (body.mood || "").trim().toLowerCase();
  const ttlSeconds = Math.max(5, Math.min(3600, Number(body.ttlSeconds || 60)));

  if ((!licenseKey && !licenseId) || !ALLOWED_MOODS.has(mood)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

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
  const url = new URL(req.url);
  const licenseId = (url.searchParams.get("licenseId") || "").trim();
  if (!licenseId) {
    return NextResponse.json({ error: "Missing licenseId" }, { status: 400 });
  }
  const room = await prisma.collaborativeRoom.findUnique({
    where: { licenseId },
    select: { mood: true, updatedAt: true },
  });
  return NextResponse.json({
    mood: room?.mood || "neutral",
    updatedAt: room?.updatedAt || null,
  });
}
