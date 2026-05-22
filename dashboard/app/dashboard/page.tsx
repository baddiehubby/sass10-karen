import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { EmbedSnippet } from "@/components/embed-snippet";
import { LicenseCustomizePanel } from "@/components/license-customize-panel";
import { DashboardCelebration } from "@/components/dashboard-celebration";
import { ensureBadgeSeeds } from "@/lib/badges";
import { getWidgetScriptUrl } from "@/lib/widget-cdn";
import { prisma } from "@/lib/prisma";
import { CopyEmbedCodeButton } from "@/components/copy-embed-code-button";
import { ComplianceActions } from "@/components/compliance-actions";
import type { License } from "@prisma/client";

function formatFeatures(features: unknown) {
  let f: Record<string, boolean> = {};
  if (typeof features === "string") {
    try {
      f = JSON.parse(features) as Record<string, boolean>;
    } catch {
      f = {};
    }
  } else if (features && typeof features === "object") {
    f = features as Record<string, boolean>;
  }
  if (!Object.keys(f).length) return "none";
  return Object.entries(f)
    .filter(([, v]) => Boolean(v))
    .map(([k]) => k)
    .join(", ");
}

function planLabel(plan: string) {
  if (plan === "free") return "Expired";
  if (plan === "pro") return "Starter";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function subscriptionStatusLabel(status: string | null, expiresAt: Date) {
  const s = (status || "").trim().toLowerCase();
  if (expiresAt.getTime() < Date.now()) return { label: "Expired", tone: "text-rose-300 border-rose-500/40 bg-rose-500/10" };
  if (s === "active" || s === "on_trial") return { label: "Active", tone: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" };
  if (s === "past_due") return { label: "Past due", tone: "text-amber-300 border-amber-500/40 bg-amber-500/10" };
  if (s === "cancelled" || s === "expired") return { label: "Cancelled", tone: "text-rose-300 border-rose-500/40 bg-rose-500/10" };
  if (s === "paused") return { label: "Paused", tone: "text-slate-300 border-slate-500/40 bg-slate-500/10" };
  if (!s || s === "free") return { label: "Trial", tone: "text-indigo-300 border-indigo-500/40 bg-indigo-500/10" };
  return { label: s.replace(/_/g, " "), tone: "text-indigo-300 border-indigo-500/40 bg-indigo-500/10" };
}

type MoodEventRow = { id: string; mood: string; domain: string | null; timestamp: Date };

type DashboardData = {
  companionName: string;
  licenses: License[];
  totalSignals: number;
  topMoodToday: string;
  moodScoreToday: number | null;
  widgetScriptUrl: string;
  activeEmbedScript: string;
  firstActiveLicense: License | null;
  allBadges: Awaited<ReturnType<typeof prisma.badge.findMany>>;
  earnedSet: Set<string>;
  recentEvents: MoodEventRow[];
};

async function loadDashboardData(userId: string): Promise<{ ok: true; data: DashboardData } | { ok: false; error: string }> {
  try {
    await ensureBadgeSeeds();

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

    const [totalSignals, todaysMoods, recentEvents] =
      licenseIds.length === 0
        ? [0, [] as { mood: string }[], [] as MoodEventRow[]]
        : await Promise.all([
            prisma.moodEvent.count({ where: { licenseId: { in: licenseIds } } }),
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
      Object.entries(moodTally).sort((a, b) => b[1] - a[1])[0]?.[0] || (totalSignals ? "neutral" : "—");

    const happyToday = todaysMoods.filter((m) => m.mood === "happy" || m.mood === "excited").length;
    const concernedToday = todaysMoods.filter((m) => m.mood === "concerned").length;
    const denomToday = happyToday + concernedToday;
    const moodScoreToday = denomToday ? Math.round((happyToday / denomToday) * 100) : null;

    const widgetScriptUrl = getWidgetScriptUrl();
    const activeEmbedScript = firstActiveLicense
      ? `<script src="${widgetScriptUrl}" data-hq-key="${firstActiveLicense.key}" async></script>`
      : "";

    const allBadges = await prisma.badge.findMany({ orderBy: { createdAt: "asc" } });
    const earnedBadges = await prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true },
    });
    const earnedSet = new Set(earnedBadges.map((b) => b.badgeId));

    return {
      ok: true,
      data: {
        companionName,
        licenses,
        totalSignals,
        topMoodToday,
        moodScoreToday,
        widgetScriptUrl,
        activeEmbedScript,
        firstActiveLicense,
        allBadges,
        earnedSet,
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

  if (!loaded.ok) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <p className="text-xs uppercase tracking-[0.24em] text-indigo-300">Buddy AI · emotional intelligence</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
        <div className="mt-8 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {loaded.error}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/api/licenses/generate?plan=starter&days=14"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Start 14-day trial license
          </Link>
          <Link
            href="/pricing"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            View pricing
          </Link>
          <Link
            href="/onboarding"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Set up your Buddy
          </Link>
        </div>
      </main>
    );
  }

  const {
    companionName,
    licenses,
    totalSignals,
    topMoodToday,
    moodScoreToday,
    widgetScriptUrl,
    activeEmbedScript,
    firstActiveLicense,
    allBadges,
    earnedSet,
    recentEvents,
  } = loaded.data;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <Suspense fallback={null}>
        <DashboardCelebration />
      </Suspense>
      <p className="text-xs uppercase tracking-[0.24em] text-indigo-300">Buddy AI · emotional intelligence</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
      <p className="mt-3 max-w-2xl text-slate-300">
        Humanize your AI with a Buddy that feels alive — and a command center that translates those feelings into
        analytics. Emotional intelligence is not a smiley; it is the signal behind every conversation.
      </p>

      {licenses.length === 0 ? (
        <section className="mt-8 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-6 py-5">
          <h2 className="text-lg font-semibold text-white">Get started with Buddy AI</h2>
          <p className="mt-2 text-sm text-slate-300">
            You&apos;re signed in. Create a trial license or finish onboarding to embed your Buddy and unlock analytics.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/api/licenses/generate?plan=starter&days=14"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Start 14-day trial
            </a>
            <Link
              href="/onboarding"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-100 hover:bg-white/10"
            >
              Set up your Buddy
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mt-8 glass-panel p-6 ring-1 ring-indigo-500/20">
        <h2 className="text-lg font-semibold text-white">
          Your Buddy, <span className="text-indigo-200">{companionName}</span>, is active.
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Your Buddy embed listens to AI output and mirrors how users feel before they even click send — then your
          dashboard turns that into emotional intelligence you can act on.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Mood signals tracked</p>
            <p className="mt-1 text-2xl font-semibold text-white">{totalSignals.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Most common mood today</p>
            <p className="mt-1 text-2xl font-semibold capitalize text-indigo-200">{topMoodToday}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Today&apos;s mood score</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {moodScoreToday == null ? "—" : `${moodScoreToday}%`}
            </p>
            <p className="mt-1 text-xs text-slate-500">Happy/excited vs concerned (today)</p>
          </div>
        </div>
        <Link
          href="/dashboard/analytics"
          className="mt-6 inline-flex rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500"
        >
          View Emotional Analytics
        </Link>
        <div className="mt-4">
          <ComplianceActions licenseId={firstActiveLicense?.id || null} />
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="/api/licenses/generate?plan=starter&days=14"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 backdrop-blur hover:bg-white/10"
        >
          Start 14-day trial license
        </a>
        <Link
          href="/pricing"
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500"
        >
          Subscribe via Lemon Squeezy
        </Link>
        <Link
          href="/dashboard/messages"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
        >
          Messages
        </Link>
        <Link
          href="/dashboard/collab"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
        >
          Collab mood
        </Link>
        <Link
          href="/dashboard/alerts"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
        >
          Alerts
        </Link>
        <Link
          href="/dashboard/audit-log"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
        >
          Audit log
        </Link>
        <Link
          href="/emotional-wellness"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
        >
          Emotional wellness
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-white">Your licenses</h2>
        <div className="mt-4 overflow-hidden glass-panel">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/70 text-slate-300">
              <tr>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">License key</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Features</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {licenses.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-slate-400" colSpan={6}>
                    No licenses yet.
                  </td>
                </tr>
              ) : (
                licenses.map((license) => {
                  const sub = subscriptionStatusLabel(license.lemonSqueezySubscriptionStatus, license.expiresAt);
                  return (
                    <tr key={license.id} className="border-t border-slate-800">
                      <td className="px-4 py-3 capitalize text-slate-200">{planLabel(license.plan)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{license.key}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs capitalize ${sub.tone}`}>
                          {sub.label}
                        </span>
                        {license.lemonSqueezyCustomerPortalUrl ? (
                          <a
                            className="mt-2 block text-xs text-emerald-300 hover:underline"
                            href={license.lemonSqueezyCustomerPortalUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open customer portal →
                          </a>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{formatFeatures(license.features)}</td>
                      <td className="px-4 py-3 text-slate-300">{new Date(license.expiresAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            className="rounded border border-indigo-500/50 px-2 py-1 text-xs text-indigo-200"
                            href={`/dashboard/theme?key=${encodeURIComponent(license.key)}`}
                          >
                            Theme
                          </Link>
                          <Link
                            className="rounded border border-violet-500/50 px-2 py-1 text-xs text-violet-200"
                            href="/pricing"
                          >
                            Upgrade
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold text-white">Embed snippet</h2>
        <p className="text-sm text-slate-400">
          Production: set <code className="rounded bg-slate-950/80 px-1 font-mono text-indigo-200">WIDGET_CDN_URL</code>{" "}
          to your CDN URL for <code className="font-mono">livingface-widget.js</code>. Development serves the bundle via{" "}
          <code className="font-mono">/api/dev/widget</code> automatically.
        </p>
        <EmbedSnippet scriptUrl={widgetScriptUrl} />
        <div className="glass-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Primary embed code</h3>
            {firstActiveLicense ? (
              <CopyEmbedCodeButton embedCode={activeEmbedScript} />
            ) : (
              <a
                href="/api/licenses/generate?plan=starter&days=14"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
              >
                Start 14-day trial license
              </a>
            )}
          </div>
          {firstActiveLicense ? (
            <>
              <p className="mt-3 text-xs text-slate-400">Using active key ending in {firstActiveLicense.key.slice(-8)}.</p>
              <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-300">
                <code>{activeEmbedScript}</code>
              </pre>
            </>
          ) : (
            <p className="mt-3 text-sm text-amber-200">
              No active license found. Generate one to copy your production-ready script tag.
            </p>
          )}
        </div>
      </section>

      <LicenseCustomizePanel licenses={licenses} />

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-white">Achievements</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allBadges.map((badge) => {
            const unlocked = earnedSet.has(badge.id);
            return (
              <article
                key={badge.id}
                className={`glass-panel p-4 ${unlocked ? "ring-1 ring-emerald-500/30" : "opacity-50 grayscale"}`}
              >
                <p className="text-2xl emoji-glyphs">{badge.icon}</p>
                <h3 className="mt-2 font-semibold text-white">{badge.name}</h3>
                <p className="mt-1 text-sm text-slate-300">{badge.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-white">Recent mood feed</h2>
        <p className="mt-1 text-sm text-slate-500">
          <Link href="/dashboard/analytics" className="text-indigo-300 hover:underline">
            Open full emotional analytics
          </Link>{" "}
          for timelines, sentiment gauge, and PDF export. Agency plans include CSV export.
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {recentEvents.length === 0 ? <li className="text-slate-500">No mood events yet. Embed your Buddy to start.</li> : null}
          {recentEvents.map((event) => (
            <li key={event.id} className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
              <span className="capitalize text-indigo-200">{event.mood}</span> • {event.domain || "unknown-domain"} •{" "}
              {new Date(event.timestamp).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
