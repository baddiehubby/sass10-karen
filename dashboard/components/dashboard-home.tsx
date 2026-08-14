"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Suspense } from "react";
import { DashboardCelebration } from "@/components/dashboard-celebration";
import { DashboardCompanionOnboarding } from "@/components/dashboard-companion-onboarding";
import { DashboardLiveOrb } from "@/components/dashboard-live-orb";
import { MoodSparkline } from "@/components/mood-sparkline";
import { PrivacyBadge } from "@/components/privacy-badge";
import { ShadowCompanionDownload } from "@/components/shadow-companion-download";
import { ShadowCompanionRegister } from "@/components/shadow-companion-register";
import { HolyMusic } from "@/components/HolyMusic";
import { BuddyHomePresence } from "@/components/buddy-home-presence";
import { formatMomentSentence, formatRelativeTime, pronounForName } from "@/lib/dashboard-format";
import { loadDisplayPrefs, type BuddyDisplayPrefs } from "@/lib/mood-memory";

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
  isAdmin?: boolean;
  brandName?: string;
  holyMusicEnabled?: boolean;
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
  isAdmin = false,
  brandName = "Buddy AI",
  holyMusicEnabled = false,
}: DashboardHomeProps) {
  const moodLabel = topMood === "—" ? "listening" : topMood;
  const pronoun = pronounForName(companionName);
  const [analyticsOptIn, setAnalyticsOptIn] = useState(false);
  const [audioPulse, setAudioPulse] = useState(0);
  const [theme, setTheme] = useState<BuddyDisplayPrefs["theme"]>("cosmic");
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    try {
      setAnalyticsOptIn(window.localStorage.getItem("buddy_analytics_opt_in") === "yes");
      setTheme(loadDisplayPrefs().theme);
    } catch {
      setAnalyticsOptIn(false);
    }
    const onPrefs = () => setTheme(loadDisplayPrefs().theme);
    window.addEventListener("buddy-prefs-changed", onPrefs);
    return () => window.removeEventListener("buddy-prefs-changed", onPrefs);
  }, []);

  const themeGlow =
    theme === "ember"
      ? "rgba(251,146,60,0.1)"
      : theme === "mist"
        ? "rgba(148,163,184,0.1)"
        : theme === "night"
          ? "rgba(30,41,59,0.35)"
          : "rgba(99,102,241,0.08)";

  return (
    <div
      className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg flex-col items-center px-6 pb-24 pt-4 text-center"
      style={{
        background: `radial-gradient(ellipse 80% 50% at 50% 18%, ${themeGlow} 0%, transparent 60%)`,
      }}
    >
      <HolyMusic enabled={holyMusicEnabled} onLevel={setAudioPulse} />
      <Suspense fallback={null}>
        <DashboardCelebration />
      </Suspense>

      {/* First viewport: Orb + ritual only */}
      <DashboardLiveOrb
        mood={moodLabel}
        licenseKey={licenseKey}
        scriptUrl={scriptUrl}
        apiBase={apiBase}
        audioPulse={audioPulse}
      />

      <BuddyHomePresence companionName={companionName} />

      <p className="mt-8 text-sm font-light tracking-wide text-white/45">
        {pronoun} been with you for{" "}
        <span className="text-white/70">
          {daysTogether} {daysTogether === 1 ? "day" : "days"}
        </span>
        .
      </p>

      <PrivacyBadge variant="dashboard" className="mt-4" optedIn={analyticsOptIn} />

      <button
        type="button"
        className="mt-10 text-xs text-white/35 hover:text-white/55"
        onClick={() => setShowMore((v) => !v)}
        aria-expanded={showMore}
      >
        {showMore ? "Hide extras" : "More · embed, timeline, devices"}
      </button>

      {showMore ? (
        <div className="mt-8 w-full space-y-10">
          <ShadowCompanionRegister licenseKey={licenseKey} />
          <ShadowCompanionDownload isAdmin={isAdmin} />
          <DashboardCompanionOnboarding licenseKey={licenseKey} />

          <div className="w-full">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/30">Embed mood timeline</p>
            <p className="mb-3 text-[11px] text-white/30">
              Widget moments from your sites — separate from personal check-ins on this device.
            </p>
            <MoodSparkline events={sparklineEvents} />
          </div>

          <div className="w-full text-left">
            <p className="mb-4 text-xs uppercase tracking-[0.2em] text-white/30">Recent embed moments</p>
            <ul className="space-y-3">
              {recentMoments.length === 0 ? (
                <li className="text-sm font-light text-white/35">
                  {hasLicense
                    ? "No embed moments yet. Your orb is listening when you place it on a site."
                    : `Sign in to activate your free ${brandName}.`}
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

          <Link href="/dashboard/settings#embed" className="inline-block text-xs text-white/30 transition hover:text-white/55">
            Embed settings
          </Link>

          {isFreeOnly ? (
            <Link href="/pricing" className="mt-2 block text-xs text-white/40 transition hover:text-violet-200/80">
              Subscribe — Starter from $20/month
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
