import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BuddieRoom } from "@/components/buddie-room";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function GardenPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <BuddieRoom title="Garden" whisper="Living rooms of mood and omen — still one Buddie.">
      <ul className="divide-y divide-white/10 border-y border-white/10">
        <li>
          <Link href="/dashboard/mood" className="flex min-h-16 items-baseline justify-between py-5 hover:text-[#e8c4a0]">
            <span className="text-lg text-[#f4efe6]">Mood Universe</span>
            <span className="text-xs text-white/35">Constellation of check-ins</span>
          </Link>
        </li>
        <li>
          <Link href="/dashboard/oracle" className="flex min-h-16 items-baseline justify-between py-5 hover:text-[#e8c4a0]">
            <span className="text-lg text-[#f4efe6]">Oracle Realm</span>
            <span className="text-xs text-white/35">Quiet readings</span>
          </Link>
        </li>
      </ul>
    </BuddieRoom>
  );
}
