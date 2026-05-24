import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { DashboardCelebration } from "@/components/dashboard-celebration";
import { BuddyOrbPreview } from "@/components/buddy-orb-preview";
import { DashboardEmbedActions } from "@/components/dashboard-embed-actions";
import { DashboardQuickActions } from "@/components/dashboard-quick-actions";
import { prisma } from "@/lib/prisma";
import { getWidgetScriptUrl } from "@/lib/widget-cdn";
import type { License } from "@prisma/client";

function planLabel(plan: string) {
  if (plan === "free") return "Expired";
  if (plan === "pro") return "Starter";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function subscriptionStatusLabel(status: string | null, expiresAt: Date) {
  const s = (status || "").trim().toLowerCase();
  if (expiresAt.getTime() < Date.now()) {
    return { label: "Expired", tone: "text-rose-300 border-rose-500/40 bg-rose-500/10" };
  }
  if (s === "active" || s === "on_trial") {
    return { label: "Active", tone: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" };
  }
  if (s === "past_due") return { label: "Past due", tone: "text-amber-300 border-amber-500/40 bg-amber-500/10" };
  if (s === "cancelled" || s === "expired") {
    return { label: "Cancelled", tone: "text-rose-300 border-rose-500/40 bg-rose-500/10" };
  }
  if (!s || s === "free") return { label: "Trial", tone: "text-indigo-300 border-indigo-500/40 bg-indigo-500/10" };
  return { label: s.replace(/_/g, " "), tone: "text-indigo-300 border-indigo-500/40 bg-indigo-500/10" };
}

type MoodEventRow = { id: string; mood: string; domain: string | null; timestamp: Date };

type DashboardData = {
  companionName: string;
  licenses: License[];
  topMoodToday: string;
  widgetScriptUrl: string;
  activeEmbedScript: string;
  firstActiveLicense: License | null;
  recentEvents: MoodEventRow[];
};

async function loadDashboardData(userId: string): Promise<{ ok: true; data: DashboardData } | { ok: false; error: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companionName: true },
    });
    const companionName = user?.companionName?.trim() || "Buddy";

    const licenses = await prisma.license.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    const licenseIds = licenses.map((l) => l.id);
    const now = Date.now();
    const firstActiveLicense = licenses.find((license) => new Date(license.expiresAt).getTime() > now) || null;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todaysMoods, recentEvents] =
      licenseIds.length === 0
        ? [[] as { mood: string }[], [] as MoodEventRow[]]
        : await Promise.all([
            prisma.moodEvent.findMany({
              where: { licenseId: { in: licenseIds }, timestamp: { gte: todayStart } },
              select: { mood: true },
            }),
            prisma.moodEvent.findMany({
              where: { licenseId: { in: licenseIds } },
              orderBy: { timestamp: "desc" },
              take: 12,
              select: { id: true, mood: true, domain: true, timestamp: true },
            }),
          ]);

    const moodTally: Record<string, number> = {};
    for (const row of todaysMoods) {
      moodTally[row.mood] = (moodTally[row.mood] || 0) + 1;
    }
    const topMoodToday =
      Object.entries(moodTally).sort((a, b) => b[1] - a[1])[0]?.[0] || (recentEvents.length ? "neutral" : "—");

    const widgetScriptUrl = getWidgetScriptUrl();
    const activeEmbedScript = firstActiveLicense
      ? `<script src="${widgetScriptUrl}" data-hq-key="${firstActiveLicense.key}" async></script>`
      : "";

    return {
      ok: true,
      data: {
        companionName,
        licenses,
        topMoodToday,
        widgetScriptUrl,
        activeEmbedScript,
        firstActiveLicense,
        recentEvents,
      },
    };
  } catch (err) {
    console.error("[dashboard] loadDashboardData", err);
    return {
      ok: false,
      error: "We could not load your dashboard data. Your account is signed in — try refreshing in a moment.",
    };
  }
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  let userId = session.user.id;
  if (!userId && session.user.email) {
    try {
      const byEmail = await prisma.user.findUnique({
        where: { email: session.user.email.toLowerCase() },
        select: { id: true },
      });
      userId = byEmail?.id ?? "";
    } catch (err) {
      console.error("[dashboard] resolve user by email", err);
    }
  }
  if (!userId) redirect("/login");

  const loaded = await loadDashboardData(userId);
  const apiBase = (process.env.NEXTAUTH_URL || "https://www.buddieai.com").replace(/\/$/, "");

  if (!loaded.ok) {
    return (
      <div>
        <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
        <div className="mt-8 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {loaded.error}
        </div>
        <Link href="/pricing" className="mt-6 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500">
          View pricing
        </Link>
      </div>
    );
  }

  const { companionName, licenses, topMoodToday, widgetScriptUrl, activeEmbedScript, firstActiveLicense, recentEvents } =
    loaded.data;

  const planLicense = firstActiveLicense || licenses[0] || null;
  const sub = planLicense
    ? subscriptionStatusLabel(planLicense.lemonSqueezySubscriptionStatus, planLicense.expiresAt)
    : null;

  return (
    <div>
      <Suspense fallback={null}>
        <DashboardCelebration />
      </Suspense>

      <p className="text-xs uppercase tracking-[0.24em] text-indigo-300">Buddy AI</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Your Buddy is alive!</h1>
      <p className="mt-2 text-slate-400">
        Welcome back — <span className="text-indigo-200">{companionName}</span> is ready to embed on your site.
      </p>

      {!firstActiveLicense ? (
        <section className="mt-8 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-6 py-5">
          <h2 className="text-lg font-semibold text-white">Get your license</h2>
          <p className="mt-2 text-sm text-slate-300">
            Start with secure checkout — your license and embed code appear here instantly after payment.
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            View pricing
          </Link>
        </section>
      ) : null}

      <section className="mt-8 glass-panel p-6 ring-1 ring-indigo-500/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Your Buddy</h2>
            <p className="mt-1 text-sm text-slate-400">
              Current mood: <span className="capitalize text-indigo-200">{topMoodToday}</span>
            </p>
            <Link href="/dashboard/settings" className="mt-2 inline-block text-sm text-indigo-300 hover:underline">
              Customize name & personality →
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <DashboardEmbedActions embedCode={activeEmbedScript} hasLicense={Boolean(firstActiveLicense)} />
          <BuddyOrbPreview
            licenseKey={firstActiveLicense?.key ?? null}
            scriptUrl={widgetScriptUrl}
            apiBase={apiBase}
          />
        </div>
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <section className="glass-panel p-5 xl:col-span-1">
          <h2 className="text-lg font-semibold text-white">Mood Activity</h2>
          <p className="mt-1 text-xs text-slate-500">Recent signals from your embed</p>
          <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm">
            {recentEvents.length === 0 ? (
              <li className="text-slate-500">No mood events yet. Add the embed to your site to start.</li>
            ) : (
              recentEvents.map((event) => (
                <li key={event.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-slate-300">
                  <span className="capitalize text-indigo-200">{event.mood}</span>
                  <span className="text-slate-500"> · {event.domain || "unknown"}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{new Date(event.timestamp).toLocaleString()}</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="glass-panel p-5">
          <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
          <p className="mt-1 text-xs text-slate-500">Analytics, reports, and billing</p>
          <div className="mt-4">
            <DashboardQuickActions licenseId={firstActiveLicense?.id ?? null} />
          </div>
        </section>

        <section className="glass-panel p-5 md:col-span-2 xl:col-span-1">
          <h2 className="text-lg font-semibold text-white">Plan</h2>
          {planLicense ? (
            <>
              <p className="mt-2 text-2xl font-bold capitalize text-white">{planLabel(planLicense.plan)}</p>
              {sub ? (
                <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs capitalize ${sub.tone}`}>
                  {sub.label}
                </span>
              ) : null}
              <p className="mt-4 text-xs uppercase tracking-wide text-slate-500">License key</p>
              <p className="mt-1 break-all font-mono text-xs text-indigo-200">{planLicense.key}</p>
              <p className="mt-3 text-xs text-slate-500">
                Expires {new Date(planLicense.expiresAt).toLocaleDateString()}
              </p>
              {planLicense.lemonSqueezyCustomerPortalUrl ? (
                <a
                  href={planLicense.lemonSqueezyCustomerPortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block text-xs text-emerald-300 hover:underline"
                >
                  Customer portal →
                </a>
              ) : null}
              <Link
                href="/pricing"
                className="mt-4 inline-flex rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
              >
                Upgrade plan
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No license yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
