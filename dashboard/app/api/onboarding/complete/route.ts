import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED = new Set(["cheerful", "calm", "genius"]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { companionName?: string; personality?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companionName = String(body.companionName || "").trim().slice(0, 60);
  const personality = String(body.personality || "").trim().toLowerCase();
  if (!companionName || !ALLOWED.has(personality)) {
    return NextResponse.json({ error: "Invalid companion setup" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      companionName,
      personality,
      onboardingCompleted: true,
    },
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("hq_onboarding_done", "1", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
