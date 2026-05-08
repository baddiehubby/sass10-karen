import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { companionName: true, personality: true, onboardingCompleted: true },
  });
  const latestLicense = await prisma.license.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { key: true },
  });

  return NextResponse.json({
    companionName: user?.companionName || "",
    personality: user?.personality || "calm",
    onboardingCompleted: Boolean(user?.onboardingCompleted),
    embedKey: latestLicense?.key || "",
  });
}
