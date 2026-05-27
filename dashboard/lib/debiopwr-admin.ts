import type { Session } from "next-auth";

export function assertDebiopwrAdmin(session: Session | null): boolean {
  const email = (session?.user?.email || "").toLowerCase();
  const adminList = (process.env.BUDDY_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email && adminList.includes(email));
}
