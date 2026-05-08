import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { AlertsFeed } from "@/components/alerts-feed";

export default async function AlertsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <p className="text-xs uppercase tracking-[0.24em] text-indigo-300">Buddy AI · compliance</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Real-time sentiment alerts</h1>
      <p className="mt-3 max-w-3xl text-slate-300">
        Human-in-the-loop oversight for EU AI Act readiness. Concerning moods are surfaced here until acknowledged.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/dashboard/audit-log" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10">
          Open audit log
        </Link>
        <Link href="/dashboard" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10">
          Back to dashboard
        </Link>
      </div>
      <div className="mt-8">
        <AlertsFeed />
      </div>
    </main>
  );
}
