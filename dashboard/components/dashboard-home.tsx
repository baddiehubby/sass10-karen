"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Suspense } from "react";
import { DashboardCelebration } from "@/components/dashboard-celebration";
import { DashboardCompanionOnboarding } from "@/components/dashboard-companion-onboarding";
import { DashboardLiveOrb } from "@/components/dashboard-live-orb";
import { MoodSparkline } from "@/components/mood-sparkline";
import { PrivacyBadge } from "@/components/privacy-badge";
import { formatMomentSentence, formatRelativeTime, pronounForName } from "@/lib/dashboard-format";

export type DashboardHomeProps = {
  companionName: string;
  topMood: string;
  daysTogether: number;
  licenseKey: string | null;
  scriptUrl: string;
  apiBase: string;
  sparklineEvents: Array<{ mood: string; timestamp: string }>;
  recentMoments: Array<{ id: string; mood: string; domain: string | null; timestamp: string }>;
  hasLicense: boolean;
  isFreeOnly: boolean;
};

export function DashboardHome({
  companionName,
  topMood,
  daysTogether,
  licenseKey,
  scriptUrl,
  apiBase,
  sparklineEvents,
  recentMoments,
  hasLicense,
  isFreeOnly,
}: DashboardHomeProps) {
  const moodLabel = topMood === "—" ? "listening" : topMood;
  const pronoun = pronounForName(companionName);
  const [analyticsOptIn, setAnalyticsOptIn] = useState(false);

  useEffect(() => {
    try {
      setAnalyticsOptIn(window.localStorage.getItem("buddy_analytics_opt_in") === "yes");
    } catch {
      setAnalyticsOptIn(false);
    }
  }, []);

  return (
    <div
      className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg flex-col items-center px-6 pb-24 pt-4 text-center"
      style={{
        background: "radial-gradient(ellipse 80% 50% at 50% 20%, rgba(99,102,241,0.08) 0%, transparent 60%)",
      }}
    >
      <Suspense fallback={null}>
        <DashboardCelebration />
      </Suspense>

      <DashboardCompanionOnboarding licenseKey={licenseKey} />

      <DashboardLiveOrb
        mood={moodLabel}
        licenseKey={licenseKey}
        scriptUrl={scriptUrl}
        apiBase={apiBase}
      />

      <PrivacyBadge variant="dashboard" className="mt-4" optedIn={analyticsOptIn} />

      <p className="mt-10 text-base font-light tracking-wide text-white/75 md:text-lg">
        Your Buddy is <span className="capitalize text-violet-200/90">{moodLabel}</span>. {pronoun} been with you
        for{" "}
        <span className="text-white/90">
          {daysTogether} {daysTogether === 1 ? "day" : "days"}
        </span>
        .
      </p>

      <div className="mt-12 w-full">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/30">Mood timeline</p>
        <MoodSparkline events={sparklineEvents} />
        <p className="mt-3 text-center text-xs text-emerald-200/75">
          Thanks to users like you, Buddy&apos;s emotional intelligence improves every day.
        </p>
      </div>

      <div className="mt-14 w-full text-left">
        <p className="mb-4 text-xs uppercase tracking-[0.2em] text-white/30">Recent moments</p>
        <ul className="space-y-3">
          {recentMoments.length === 0 ? (
            <li className="text-sm font-light text-white/35">
              {hasLicense
                ? "No moments yet. Your orb is listening — embed it on your site to begin."
                : "Sign in to activate your free Buddy — moments will appear here."}
            </li>
          ) : (
            recentMoments.slice(0, 5).map((ev) => (
              <li key={ev.id} className="border-b border-white/5 pb-3 text-sm font-light text-white/55">
                {formatMomentSentence(ev.mood, ev.domain)} • {formatRelativeTime(new Date(ev.timestamp))}
              </li>
            ))
          )}
        </ul>
      </div>

      <Link href="/dashboard/settings#embed" className="mt-10 text-xs text-white/30 transition hover:text-white/55">
        Embed
      </Link>

      {isFreeOnly ? (
        <Link
          href="/pricing"
          className="mt-6 text-xs text-white/40 transition hover:text-violet-200/80"
        >
          Free — Upgrade for analytics &amp; custom themes
        </Link>
      ) : null}

    </div>
  );
}
