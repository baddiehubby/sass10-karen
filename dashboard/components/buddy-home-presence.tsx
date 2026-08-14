"use client";

import { useEffect, useState } from "react";
import { BuddyGreeting } from "@/components/buddy-greeting";
import { BuddyMeet } from "@/components/buddy-meet";
import { MoodPicker } from "@/components/mood-picker";
import { ShareCard } from "@/components/share-card";
import { WorldPortal } from "@/components/world-portal";
import {
  checkInReply,
  loadUniverse,
  recordBuddyCheckIn,
  setIntention,
  type UniverseSnapshot,
} from "@/lib/buddy-universe";
import {
  INTENTION_CHIPS,
  ritualDoneToday,
  ritualPrompt,
  ritualWindow,
  todaysIntention,
} from "@/lib/daily-ritual";
import { type BuddyMood, type CompanionPersonality } from "@/lib/companion-mood";
import { hasCompletedMeet, loadPersonality } from "@/lib/mood-memory";
import { UNIVERSE_FLAGS } from "@/lib/universe-flags";
import { discoverBuddyMemory, fetchBuddyPresence, notifySoul } from "@/lib/buddy-soul-client";
import type { PublicBond } from "@/lib/buddy-soul-types";

type BuddyHomePresenceProps = {
  companionName: string;
};

export function BuddyHomePresence({ companionName }: BuddyHomePresenceProps) {
  const [ready, setReady] = useState(false);
  const [showMeet, setShowMeet] = useState(false);
  const [awakeLine, setAwakeLine] = useState<string | null>(null);
  const [snap, setSnap] = useState<UniverseSnapshot | null>(null);
  const [personality, setPersonality] = useState<CompanionPersonality>("warm");
  const [showIntention, setShowIntention] = useState(false);
  const [momentLine, setMomentLine] = useState<string | null>(null);
  const [editVibe, setEditVibe] = useState(false);
  const [soul, setSoul] = useState<PublicBond | null>(null);
  const windowKind = ritualWindow();

  useEffect(() => {
    const sync = () => {
      setSnap(loadUniverse());
      setPersonality(loadPersonality());
    };
    sync();
    setShowMeet(!hasCompletedMeet());
    setReady(true);
    void fetchBuddyPresence().then((bond) => {
      if (!bond) return;
      setSoul(bond);
    });
    window.addEventListener("buddy-mood-changed", sync);
    window.addEventListener("buddy-universe-changed", sync);
    return () => {
      window.removeEventListener("buddy-mood-changed", sync);
      window.removeEventListener("buddy-universe-changed", sync);
    };
  }, []);

  function checkIn(mood: BuddyMood) {
    const next = recordBuddyCheckIn(mood);
    setSnap(next);
    setAwakeLine(checkInReply(mood));
    setMomentLine(next.moment?.line ?? null);
    setEditVibe(false);
    void notifySoul("mood_shared", mood).then((bond) => {
      if (bond) setSoul(bond);
    });
    if (UNIVERSE_FLAGS.dailyRitual && windowKind === "morning" && !todaysIntention(next.identity)) {
      setShowIntention(true);
    }
  }

  if (!ready || !snap) {
    return <p className="mt-10 text-sm text-white/35">Hey. You&apos;re back.</p>;
  }

  const ritualComplete = ritualDoneToday(snap.identity, windowKind);
  const prompt = UNIVERSE_FLAGS.dailyRitual
    ? ritualPrompt(windowKind, companionName, personality)
    : "Hey. How are you feeling?";
  const intention = todaysIntention(snap.identity);

  return (
    <div className="mt-8 w-full">
      {showMeet ? <BuddyMeet companionName={companionName} onDone={() => setShowMeet(false)} /> : null}

      {snap.unlockTitle ? (
        <div className="mb-6">
          <ShareCard kind="milestone" title={snap.unlockTitle} line="A new look found you. Identity, not a score." />
        </div>
      ) : null}

      <BuddyGreeting line={awakeLine ?? prompt} />
      {momentLine ? <p className="mt-3 text-sm text-white/55">{momentLine}</p> : null}
      {soul?.available ? (
        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-white/30">
          {soul.stageLabel}
          <span className="mx-2 text-white/15">·</span>
          Buddy feels {soul.buddyMood}
        </p>
      ) : snap.entries.length > 0 ? (
        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-white/30">Growing with your check-ins</p>
      ) : null}

      {soul?.available && soul.hiddenMemories > 0 ? (
        <button
          type="button"
          className="mt-4 text-xs text-white/45 hover:text-white/70"
          onClick={() => {
            void discoverBuddyMemory().then((bond) => {
              if (!bond) return;
              setSoul(bond);
              if (bond.verse) setMomentLine(bond.verse);
            });
          }}
        >
          A memory is waiting in the constellation
        </button>
      ) : null}

      {soul?.verse ? <p className="mt-3 text-sm italic text-white/55">{soul.verse}</p> : null}
      {intention ? <p className="mt-2 text-xs text-white/35">Today: {intention}</p> : null}

      {ritualComplete && !awakeLine && !editVibe ? (
        <div className="mt-6">
          <p className="text-sm text-white/40">Today&apos;s vibe is set. Come back whenever.</p>
          <button type="button" className="mt-3 text-xs text-white/35 hover:text-white/60" onClick={() => setEditVibe(true)}>
            Update vibe
          </button>
        </div>
      ) : (
        <>
          <p className="mt-8 text-sm text-white/55">{windowKind === "evening" ? "How was today?" : "How are you feeling?"}</p>
          <div className="mt-4">
            <MoodPicker selected={snap.entries[0]?.mood ?? null} onSelect={checkIn} />
          </div>
        </>
      )}

      {showIntention ? (
        <div className="mt-6">
          <p className="text-sm text-white/50">A small intention? Optional.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {INTENTION_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className="min-h-11 rounded-full border border-white/12 px-3 text-xs text-white/65 hover:border-white/30"
                onClick={() => {
                  setSnap({ ...snap, identity: setIntention(chip) });
                  setShowIntention(false);
                  void notifySoul("ritual_completed", snap.entries[0]?.mood);
                }}
              >
                {chip}
              </button>
            ))}
            <button type="button" className="min-h-11 px-3 text-xs text-white/30" onClick={() => setShowIntention(false)}>
              Skip
            </button>
          </div>
        </div>
      ) : null}

      {UNIVERSE_FLAGS.vibeProfile && snap.vibe.id !== "still-forming" ? (
        <div className="mt-8">
          <ShareCard kind="vibe" title={snap.vibe.title} line={snap.vibe.line} />
        </div>
      ) : null}

      <WorldPortal href="/dashboard/mood" hint="Mood Universe" label="See your emotional constellation" />
      <WorldPortal href="/dashboard/oracle" hint="Oracle Realm" label="Step into a quieter world" />
    </div>
  );
}
