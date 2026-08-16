import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-json";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { onboardingCompleteBodySchema } from "@/lib/validation";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody(req, onboardingCompleteBodySchema);
  if (!parsed.ok) return parsed.response;

  const { companionName, personality } = parsed.data;

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
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
