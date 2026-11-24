import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = {
  from?: string;
  to?: string;
  mood?: string;
};

export default async function AuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const fromRaw = (searchParams.from || "").trim();
  const toRaw = (searchParams.to || "").trim();
  const mood = (searchParams.mood || "").trim().toLowerCase();

  const fromDate = fromRaw ? new Date(fromRaw) : null;
  const toDate = toRaw ? new Date(`${toRaw}T23:59:59.999Z`) : null;
  const validFrom = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null;
  const validTo = toDate && !Number.isNaN(toDate.getTime()) ? toDate : null;

  const events = await prisma.moodEvent.findMany({
    where: {
      license: { userId: session.user.id },
      ...(mood ? { mood } : {}),
      ...(validFrom || validTo
        ? {
            timestamp: {
              ...(validFrom ? { gte: validFrom } : {}),
              ...(validTo ? { lte: validTo } : {}),
            },
          }
        : {}),
    },
    orderBy: { timestamp: "desc" },
    take: 2000,
    select: {
      id: true,
      mood: true,
      timestamp: true,
      domain: true,
      messageSnippet: true,
      acknowledgedAt: true,
      acknowledgedBy: true,
      license: { select: { key: true } },
    },
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <p className="text-xs uppercase tracking-[0.24em] text-indigo-300">Buddy AI · human oversight</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Audit log</h1>
      <p className="mt-3 max-w-3xl text-slate-300">
        Full event-level record showing when a human acknowledged concern signals.
      </p>

      <form method="GET" className="mt-6 glass-panel grid gap-4 p-4 sm:grid-cols-4">
        <label className="text-sm text-slate-300">
          <span className="mb-1 block text-xs text-slate-500">From</span>
          <input type="date" name="from" defaultValue={fromRaw} className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-2 text-slate-100" />
        </label>
        <label className="text-sm text-slate-300">
          <span className="mb-1 block text-xs text-slate-500">To</span>
          <input type="date" name="to" defaultValue={toRaw} className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-2 text-slate-100" />
        </label>
        <label className="text-sm text-slate-300">
          <span className="mb-1 block text-xs text-slate-500">Mood</span>
          <select name="mood" defaultValue={mood} className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-2 text-slate-100">
            <option value="">All moods</option>
            <option value="neutral">neutral</option>
            <option value="happy">happy</option>
            <option value="thinking">thinking</option>
            <option value="concerned">concerned</option>
            <option value="angry">angry</option>
            <option value="excited">excited</option>
            <option value="sleepy">sleepy</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            Apply filters
          </button>
          <Link href="/dashboard/audit-log" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/10">
            Reset
          </Link>
        </div>
      </form>

      <section className="mt-6 glass-panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/70 text-slate-300">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Mood</th>
              <th className="px-4 py-3">Snippet</th>
              <th className="px-4 py-3">License</th>
              <th className="px-4 py-3">Acknowledgment</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-slate-500">
                  No events found for the selected filters.
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-slate-300">{new Date(event.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-3 capitalize text-indigo-200">{event.mood}</td>
                  <td className="px-4 py-3 text-slate-300">{event.messageSnippet || event.domain || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">…{event.license.key.slice(-8)}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {event.acknowledgedAt ? (
                      <span className="text-emerald-300">
                        Acknowledged {new Date(event.acknowledgedAt).toLocaleString()}
                        {event.acknowledgedBy ? ` by ${event.acknowledgedBy.slice(0, 8)}…` : ""}
                      </span>
                    ) : (
                      <span className="text-amber-300">Unacknowledged</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
