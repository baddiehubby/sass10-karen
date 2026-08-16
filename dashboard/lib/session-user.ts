import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Resolve authenticated user id from the verified server session only.
 * Never accepts client-supplied user IDs. Returns null when unauthenticated or invalidated.
 */
export async function sessionUserId(): Promise<string | null> {
  const session = (await getServerSession(authOptions)) as Session | null;
  const id = session?.user?.id;
  if (typeof id !== "string" || id.length < 8) return null;
  return id;
}
