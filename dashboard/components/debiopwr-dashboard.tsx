"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EIDATA_ALWAYS_COLLECT_WITH_CONSENT, EIDATA_NEVER_COLLECT, REGULATORY_FRAMEWORKS } from "@/lib/eidata-compliance";
import { EIDATA_MONETIZATION_TIERS } from "@/lib/eidata-flywheel";

type Summary = {
  totalEvents: number;
  totalEventsAllTime: number;
  uniqueSessions30d: number;
  flywheelTarget: number;
  flywheelPercent: number;
  last24hEvents: number;
  byMood: Array<{ mood: string; count: number }>;
  byRegion: Array<{ region: string | null; count: number }>;
  bySource: Array<{ source: string | null; count: number }>;
  byCompanionType?: Array<{ companionType: string | null; count: number }>;
  dailyActiveSessions?: Array<{ date: string; sessions: number }>;
  consentRate?: {
    anonymousAnalyticsGrantRate: number;
    modelTrainingGrantRate: number;
    companionGrantRate: number;
    totalUsersWithConsentRows: number;
  };
  topMoodTriggers?: Array<{ mood: string; count: number }>;
  consentStats: Array<{ purpose: string; status: string; count: number }>;
};

type DebiopwrDashboardProps = {
  apiBase?: string;
};

export function DebiopwrDashboard({ apiBase = "/api/debiopwr" }: DebiopwrDashboardProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`${apiBase}/summary`, { cache: "no-store" });
    if (!res.ok) {
      setError(res.status === 403 ? "Admin access required (BUDDY_ADMIN_EMAILS)." : "Failed to load Debiopwr.");
      return;
    }
    setError(null);
    setSummary(await res.json());
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  if (error) {
    return (
      <div className="luxury-card rounded-2xl border border-rose-500/30 p-6 text-center text-sm text-rose-200/90">
        {error}
        <Link href="/dashboard" className="mt-4 block text-violet-300 underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!summary) {
    return <p className="text-center text-sm text-white/45">Loading Debiopwr intelligence…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-200/60">Founder · Debiopwr</p>
        <h1 className="mt-2 text-3xl font-light text-white">Emotional Intelligence Data Layer</h1>
        <p className="mt-2 text-sm text-white/50">Consent-verified, anonymized mood dataset — no raw conversation text.</p>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={refreshing}
          className="mt-4 rounded-full border border-white/15 px-4 py-1.5 text-xs text-white/70 hover:bg-white/5 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section className="luxury-card rounded-2xl border border-amber-400/20 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-amber-100/90">Anonymized events flywheel</h2>
            <p className="mt-1 text-xs text-white/45">
              {summary.totalEventsAllTime.toLocaleString()} / {summary.flywheelTarget.toLocaleString()} all time
            </p>
          </div>
          <p className="text-2xl font-light text-amber-200">{summary.flywheelPercent}%</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-amber-400"
            style={{ width: `${summary.flywheelPercent}%` }}
          />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Events (30d)" value={summary.totalEvents} />
        <StatCard label="Last 24h" value={summary.last24hEvents} />
        <StatCard label="Unique sessions (30d)" value={summary.uniqueSessions30d} />
      </div>

      {summary.consentRate ? (
        <section className="luxury-card rounded-2xl border border-white/10 p-5">
          <h2 className="text-sm font-medium text-white/80">Consent rates</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-center text-sm">
            <div>
              <p className="text-2xl text-violet-200">{summary.consentRate.companionGrantRate}%</p>
              <p className="text-xs text-white/45">Companion mood</p>
            </div>
            <div>
              <p className="text-2xl text-emerald-200">{summary.consentRate.anonymousAnalyticsGrantRate}%</p>
              <p className="text-xs text-white/45">Anonymous analytics</p>
            </div>
            <div>
              <p className="text-2xl text-sky-200">{summary.consentRate.modelTrainingGrantRate}%</p>
              <p className="text-xs text-white/45">Model training</p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <BucketList title="Mood distribution" items={summary.byMood.map((r) => ({ label: r.mood, count: r.count }))} />
        <BucketList
          title="Top emotional signals (mood labels)"
          items={(summary.topMoodTriggers ?? summary.byMood).map((r) => ({ label: r.mood, count: r.count }))}
        />
        <BucketList title="Geographic breakdown" items={summary.byRegion.map((r) => ({ label: r.region || "—", count: r.count }))} />
        <BucketList title="Platform breakdown" items={summary.bySource.map((r) => ({ label: r.source || "—", count: r.count }))} />
        <BucketList
          title="Companion type"
          items={(summary.byCompanionType ?? []).map((r) => ({ label: r.companionType || "buddy", count: r.count }))}
        />
      </div>

      {summary.dailyActiveSessions && summary.dailyActiveSessions.length > 0 ? (
        <section className="luxury-card rounded-2xl border border-white/10 p-5">
          <h2 className="text-sm font-medium text-white/80">Daily active sessions</h2>
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-white/55">
            {summary.dailyActiveSessions.map((d) => (
              <li key={d.date} className="flex justify-between">
                <span>{d.date}</span>
                <span>{d.sessions}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="luxury-card rounded-2xl border border-emerald-500/20 p-5 text-sm">
        <h2 className="font-medium text-emerald-100/90">Data export (licensing-ready)</h2>
        <p className="mt-2 text-white/50">k-anonymized aggregates (≥5 events per bucket). Filter via query params.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`${apiBase}/export?days=30&format=csv`}
            className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100"
          >
            CSV (30d)
          </a>
          <a
            href={`${apiBase}/export?days=30&format=json`}
            className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/80"
          >
            JSON (30d)
          </a>
        </div>
      </section>

      <section className="luxury-card rounded-2xl border border-violet-500/20 p-5">
        <h2 className="text-sm font-medium text-violet-100/90">Monetization path</h2>
        <ul className="mt-3 space-y-2 text-xs text-white/55">
          {EIDATA_MONETIZATION_TIERS.map((tier) => (
            <li key={tier.id}>
              <span className="font-medium text-white/75">
                {tier.name} ({tier.price})
              </span>{" "}
              — {tier.note}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="luxury-card rounded-2xl border border-white/10 p-5 text-center">
      <p className="text-xs uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-2 text-3xl font-light text-violet-200">{value.toLocaleString()}</p>
    </div>
  );
}

function BucketList({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  return (
    <section className="luxury-card rounded-2xl border border-white/10 p-5">
      <h2 className="text-sm font-medium text-white/80">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm text-white/60">
        {items.length === 0 ? (
          <li className="text-white/40">—</li>
        ) : (
          items.map((r) => (
            <li key={r.label} className="flex justify-between capitalize">
              <span>{r.label}</span>
              <span>{r.count}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
