import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CollabMoodPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const licenses = await prisma.license.findMany({
    where: { userId: session.user.id, plan: "agency" },
    select: { id: true, key: true },
    orderBy: { createdAt: "desc" },
  });

  const rooms = licenses.length
    ? await prisma.collaborativeRoom.findMany({
        where: { licenseId: { in: licenses.map((l) => l.id) } },
        orderBy: { updatedAt: "desc" },
      })
    : [];
  const roomsMap = new Map(rooms.map((r) => [r.licenseId, r]));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-semibold text-white">Collaborative Mood</h1>
      <p className="mt-2 text-slate-300">
        Agency widgets synchronize mood across domains by posting and polling <code>/api/widget/mood</code>.
      </p>

      <div className="mt-6 space-y-3">
        {licenses.length === 0 ? (
          <div className="glass-panel p-5 text-slate-400">No agency license found yet.</div>
        ) : (
          licenses.map((license) => {
            const room = roomsMap.get(license.id);
            return (
              <article key={license.id} className="glass-panel p-5">
                <h2 className="text-lg font-semibold text-white">License …{license.key.slice(-6)}</h2>
                <p className="mt-2 text-slate-200">Current shared mood: <strong>{room?.mood || "neutral"}</strong></p>
                <p className="mt-1 text-xs text-slate-400">
                  Last update: {room?.updatedAt ? new Date(room.updatedAt).toLocaleString() : "No updates yet"}
                </p>
              </article>
            );
          })
        )}
      </div>
    </main>
  );
}
