import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function sessionUserId(): Promise<string | null> {
  const session = (await getServerSession(authOptions)) as Session | null;
  if (!session?.user) return null;
  if (session.user.id) return session.user.id;
  if (!session.user.email) return null;
  const byEmail = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true },
  });
  return byEmail?.id ?? null;
}
