import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BuddieRoom } from "@/components/buddie-room";
import { authOptions } from "@/lib/auth";
import { daysSince, formatRelativeTime } from "@/lib/dashboard-format";
import { ensureFreeLicenseForUser } from "@/lib/free-license";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  await ensureFreeLicenseForUser(session.user.id);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { createdAt: true, companionName: true },
  });
  const licenses = await prisma.license.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, plan: true, activatedAt: true },
  });

  const together = daysSince(licenses[0]?.createdAt ?? user?.createdAt ?? new Date());
  const beats = [
    { label: "You arrived", at: user?.createdAt },
    { label: "Sacred Day began", at: licenses.find((l) => l.plan === "free")?.createdAt },
    {
      label: "Premium presence",
      at: licenses.find((l) => l.plan !== "free")?.activatedAt ?? null,
    },
  ].filter((b) => b.at);

  return (
    <BuddieRoom title="Timeline" whisper="A quiet relationship thread — not analytics.">
      <p className="text-lg text-[#e8c4a0]/90">
        {together} {together === 1 ? "day" : "days"} with {user?.companionName || "Buddie"}
      </p>
      <ol className="space-y-6 border-l border-white/15 pl-5">
        {beats.map((b) => (
          <li key={b.label} className="relative">
            <span className="absolute -left-[1.4rem] top-1.5 h-2 w-2 rounded-full bg-[#e8c4a0]/80" />
            <p className="text-[#f4efe6]/90">{b.label}</p>
            <p className="text-xs text-white/35">
              {b.at ? formatRelativeTime(new Date(b.at)) : ""}
            </p>
          </li>
        ))}
      </ol>
      <Link href="/dashboard/mood" className="inline-block text-sm text-white/50 hover:text-[#e8c4a0]">
        Open Mood Universe →
      </Link>
    </BuddieRoom>
  );
}
