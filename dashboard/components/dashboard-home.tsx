"use client";

import Link from "next/link";
import { Suspense } from "react";
import { DashboardCelebration } from "@/components/dashboard-celebration";
import { DashboardLiveOrb } from "@/components/dashboard-live-orb";
import { MoodSparkline } from "@/components/mood-sparkline";
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
}: DashboardHomeProps) {
  const moodLabel = topMood === "—" ? "listening" : topMood;
  const pronoun = pronounForName(companionName);

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

      <DashboardLiveOrb
        mood={moodLabel}
        licenseKey={licenseKey}
        scriptUrl={scriptUrl}
        apiBase={apiBase}
      />

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
      </div>

      <div className="mt-14 w-full text-left">
        <p className="mb-4 text-xs uppercase tracking-[0.2em] text-white/30">Recent moments</p>
        <ul className="space-y-3">
          {recentMoments.length === 0 ? (
            <li className="text-sm font-light text-white/35">
              {hasLicense
                ? "No moments yet. Your orb is listening — embed it on your site to begin."
                : "Keep your orb alive with a license — then moments will appear here."}
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

      {!hasLicense ? (
        <Link
          href="/pricing"
          className="mt-6 rounded-full border border-violet-500/25 px-5 py-2 text-xs text-violet-200/80 hover:bg-violet-500/10"
        >
          Keep your orb alive
        </Link>
      ) : null}
    </div>
  );
}
