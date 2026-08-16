import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BuddieRoom } from "@/components/buddie-room";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RitualsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rituals = await prisma.dailyRitual.findMany({
    where: { userId: session.user.id, ritualDate: today },
    select: { id: true, ritualType: true, completed: true, buddyWhisper: true },
  });

  return (
    <BuddieRoom title="Rituals" whisper="Morning light, evening hush — no streak counters.">
      {rituals.length === 0 ? (
        <p className="text-[#f4efe6]/85">
          Return home and meet Buddie in the first viewport — rituals bloom from presence, not forms.
        </p>
      ) : (
        <ul className="space-y-5">
          {rituals.map((r) => (
            <li key={r.id} className="border-b border-white/10 pb-4">
              <p className="text-[#f4efe6]">{r.ritualType}</p>
              <p className="mt-1 text-sm text-white/45">
                {r.completed ? r.buddyWhisper || "Completed softly." : "Waiting for you."}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-white/40">
        Tip: open Home, breathe with the orb, set a tiny intention. That is the ritual.
      </p>
    </BuddieRoom>
  );
}
