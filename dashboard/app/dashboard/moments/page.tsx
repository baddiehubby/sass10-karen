import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BuddieRoom } from "@/components/buddie-room";
import { authOptions } from "@/lib/auth";
import { formatMomentSentence, formatRelativeTime } from "@/lib/dashboard-format";
import { ensureFreeLicenseForUser } from "@/lib/free-license";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MomentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  await ensureFreeLicenseForUser(session.user.id);

  const licenses = await prisma.license.findMany({
    where: { userId: session.user.id },
    select: { id: true },
  });
  const licenseIds = licenses.map((l) => l.id);

  const events =
    licenseIds.length === 0
      ? []
      : await prisma.moodEvent.findMany({
          where: { licenseId: { in: licenseIds } },
          orderBy: { timestamp: "desc" },
          take: 12,
          select: { id: true, mood: true, domain: true, timestamp: true },
        });

  return (
    <BuddieRoom title="Moments" whisper="Sparks from your shared days — soft, not scored.">
      {events.length === 0 ? (
        <p className="text-[#f4efe6]/85">No moments yet. Check in from Home when you feel like it.</p>
      ) : (
        <ul className="space-y-4">
          {events.map((ev) => (
            <li key={ev.id} className="border-b border-white/10 pb-3 text-sm text-white/65">
              {formatMomentSentence(ev.mood, ev.domain)} · {formatRelativeTime(ev.timestamp)}
            </li>
          ))}
        </ul>
      )}
    </BuddieRoom>
  );
}
