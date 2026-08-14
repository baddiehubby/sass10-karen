import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { presenceForUser } from "@/lib/buddy-soul";
import { sessionUserId } from "@/lib/session-user";

export async function POST() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { personality: true },
  });
  const bond = await presenceForUser(userId, user?.personality);
  return NextResponse.json({ bond });
}
