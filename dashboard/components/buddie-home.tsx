"use client";

import Link from "next/link";
import { Suspense } from "react";
import { DashboardCelebration } from "@/components/dashboard-celebration";
import { DashboardLiveOrb } from "@/components/dashboard-live-orb";
import { BuddyHomePresence } from "@/components/buddy-home-presence";
import { HolyMusic } from "@/components/HolyMusic";
import { pronounForName } from "@/lib/dashboard-format";

export type BuddieHomeProps = {
  companionName: string;
  topMood: string;
  daysTogether: number;
  licenseKey: string | null;
  scriptUrl: string;
  apiBase: string;
  isSacredDay: boolean;
  subscriptionLabel: string;
  portalUrl: string | null;
  holyMusicEnabled?: boolean;
};

const ROOMS = [
  { href: "/dashboard/timeline", label: "Timeline", whisper: "Your days together" },
  { href: "/dashboard/memories", label: "Memories", whisper: "What you've shared" },
  { href: "/dashboard/garden", label: "Garden", whisper: "Mood & Oracle worlds" },
  { href: "/dashboard/rituals", label: "Rituals", whisper: "Morning & evening" },
  { href: "/dashboard/moments", label: "Moments", whisper: "Recent sparks" },
] as const;

export function BuddieHome({
  companionName,
  topMood,
  daysTogether,
  licenseKey,
  scriptUrl,
  apiBase,
  isSacredDay,
  subscriptionLabel,
  portalUrl,
  holyMusicEnabled = false,
}: BuddieHomeProps) {
  const moodLabel = topMood === "—" ? "listening" : topMood;
  const pronoun = pronounForName(companionName);

  return (
    <div className="buddie-home mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl flex-col items-center px-6 pb-28 pt-2 text-center">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[55vh] buddie-aurora opacity-80" aria-hidden />
      <HolyMusic enabled={holyMusicEnabled} />
      <Suspense fallback={null}>
        <DashboardCelebration />
      </Suspense>

      <p className="buddie-brand relative z-10 mb-1 text-3xl text-[#f4efe6]">Buddie</p>
      <p className="relative z-10 text-[11px] uppercase tracking-[0.28em] text-white/30">
        {subscriptionLabel}
      </p>

      <div className="relative z-10 mt-4 w-full">
        <DashboardLiveOrb
          mood={moodLabel}
          licenseKey={licenseKey}
          scriptUrl={scriptUrl}
          apiBase={apiBase}
        />
      </div>

      <BuddyHomePresence companionName={companionName} />

      <p className="relative z-10 mt-8 text-sm font-light tracking-wide text-white/45">
        {pronoun} been with you for{" "}
        <span className="text-[#e8c4a0]/90">
          {daysTogether} {daysTogether === 1 ? "day" : "days"}
        </span>
        .
      </p>

      {isSacredDay ? (
        <div className="relative z-10 mt-10 w-full max-w-sm space-y-3">
          <p className="buddie-display text-xl text-[#f4efe6]">Sacred Day</p>
          <p className="text-sm leading-relaxed text-white/50">
            You&apos;re already home with Buddie. When you&apos;re ready, Premium deepens memory,
            garden, and rituals — without starting over.
          </p>
          <Link href="/pricing" className="buddie-cta inline-flex min-h-12 items-center justify-center px-8">
            Open Premium invitation
          </Link>
        </div>
      ) : null}

      <nav className="relative z-10 mt-14 w-full" aria-label="Buddie rooms">
        <ul className="divide-y divide-white/8 border-y border-white/10 text-left">
          {ROOMS.map((room) => (
            <li key={room.href}>
              <Link
                href={room.href}
                className="flex min-h-14 items-baseline justify-between gap-4 py-4 transition hover:text-[#e8c4a0]"
              >
                <span className="text-[15px] text-[#f4efe6]/90">{room.label}</span>
                <span className="text-xs text-white/30">{room.whisper}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="relative z-10 mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-white/35">
        <Link href="/dashboard/account" className="hover:text-white/60">
          Account
        </Link>
        <Link href="/dashboard/settings" className="hover:text-white/60">
          Settings
        </Link>
        {portalUrl ? (
          <a href={portalUrl} className="hover:text-white/60" target="_blank" rel="noreferrer">
            Subscription
          </a>
        ) : (
          <Link href="/pricing" className="hover:text-white/60">
            Subscription
          </Link>
        )}
      </div>
    </div>
  );
}
