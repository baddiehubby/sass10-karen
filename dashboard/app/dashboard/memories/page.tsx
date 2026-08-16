import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BuddieRoom } from "@/components/buddie-room";
import { authOptions } from "@/lib/auth";
import { getUserEntitlement } from "@/lib/billing/entitlement";
import { ensureFreeLicenseForUser } from "@/lib/free-license";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MemoriesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  await ensureFreeLicenseForUser(session.user.id);

  const entitlement = await getUserEntitlement(session.user.id);
  const ents = entitlement.entitlements;

  const fragments = await prisma.memoryFragment.findMany({
    where: { userId: session.user.id, hidden: false },
    orderBy: { createdAt: "desc" },
    take: Math.min(ents.memoryCapacity, 40),
    select: { id: true, verse: true, bornFromMood: true, createdAt: true },
  });

  return (
    <BuddieRoom title="Memories" whisper="Only what you've truly shared — never invented.">
      <p className="text-sm text-white/40">Soft shelf · up to {ents.memoryCapacity} notes on your path.</p>
      {fragments.length === 0 ? (
        <p className="text-[#f4efe6]/80">
          The shelf is quiet. Stay with Buddie through rituals and moods — memories gather when they&apos;re real.
        </p>
      ) : (
        <ul className="space-y-5">
          {fragments.map((f) => (
            <li key={f.id} className="border-b border-white/10 pb-4">
              <p className="text-[15px] leading-relaxed text-[#f4efe6]/85">{f.verse}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/30">{f.bornFromMood}</p>
            </li>
          ))}
        </ul>
      )}
    </BuddieRoom>
  );
}
