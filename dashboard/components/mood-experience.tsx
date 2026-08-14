"use client";

import { useEffect, useMemo, useState } from "react";
import { BuddyOrb } from "@/components/buddy-orb";
import { MoodConstellation } from "@/components/mood-constellation";
import { MoodPicker } from "@/components/mood-picker";
import { ShareCard } from "@/components/share-card";
import { WorldPortal } from "@/components/world-portal";
import {
  checkInReply,
  loadUniverse,
  recordBuddyCheckIn,
  recordCheckInNote,
  type UniverseSnapshot,
} from "@/lib/buddy-universe";
import { notifySoul } from "@/lib/buddy-soul-client";
import { deriveMoodState, insightLine, type BuddyMood, type MoodCheckIn } from "@/lib/companion-mood";
import { uniqueDays, seasonalVeilId } from "@/lib/orb-evolution";
import {
  EVOLUTION_LABEL,
  evolutionClassName,
  evolutionHint,
  reconcileEvolutionStage,
} from "@/lib/buddy-evolution";
import { pickBuddyMoment } from "@/lib/buddy-moments";
import { interactionFromWake, type OrbInteraction } from "@/lib/orb-state";
import { UNIVERSE_FLAGS } from "@/lib/universe-flags";
import { clearCheckIns, effectiveReducedMotion } from "@/lib/mood-memory";

type MoodRange = "today" | "7d" | "30d" | "all";

type MoodExperienceProps = {
  historyDays: number;
  tierLabel: string;
  sharePremium: boolean;
};

function filterByRange(entries: MoodCheckIn[], range: MoodRange, historyDays: number): MoodCheckIn[] {
  const now = Date.now();
  const dayMs = 86_400_000;
  let cutoff = 0;
  if (range === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    cutoff = d.getTime();
  } else if (range === "7d") cutoff = now - 7 * dayMs;
  else if (range === "30d") cutoff = now - Math.min(30, historyDays) * dayMs;
  else cutoff = now - historyDays * dayMs;
  return entries.filter((e) => new Date(e.createdAt).getTime() >= cutoff).slice(0, historyDays === 7 ? 14 : 90);
}

export function MoodExperience({ historyDays, tierLabel, sharePremium }: MoodExperienceProps) {
  const [snap, setSnap] = useState<UniverseSnapshot | null>(null);
  const [selected, setSelected] = useState<BuddyMood | null>(null);
  const [note, setNote] = useState("");
  const [askWhy, setAskWhy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [range, setRange] = useState<MoodRange>("7d");
  const [interaction, setInteraction] = useState<OrbInteraction>("idle");
  const [reduce, setReduce] = useState(false);
  const state = useMemo(() => deriveMoodState(snap?.entries ?? []), [snap]);
  const visible = useMemo(
    () => filterByRange(snap?.entries ?? [], range, historyDays),
    [snap, range, historyDays],
  );
  const weekDays = uniqueDays(snap?.entries ?? []).slice(-7).length;
  const stage = useMemo(() => reconcileEvolutionStage(snap?.entries ?? []), [snap]);
  const moment = useMemo(() => {
    if (!snap || !UNIVERSE_FLAGS.buddyMoments) return null;
    return pickBuddyMoment(snap.entries, snap.identity, state.trend);
  }, [snap, state.trend]);

  useEffect(() => {
    if (!UNIVERSE_FLAGS.moodUniverse) return;
    const sync = () => {
      setSnap(loadUniverse());
      setReduce(effectiveReducedMotion());
    };
    sync();
    window.addEventListener("buddy-mood-changed", sync);
    window.addEventListener("buddy-universe-changed", sync);
    window.addEventListener("buddy-prefs-changed", sync);
    return () => {
      window.removeEventListener("buddy-mood-changed", sync);
      window.removeEventListener("buddy-universe-changed", sync);
      window.removeEventListener("buddy-prefs-changed", sync);
    };
  }, []);

  if (!UNIVERSE_FLAGS.moodUniverse) {
    return <p className="px-6 py-20 text-center text-sm text-white/35">Mood Universe is paused.</p>;
  }

  if (!snap) {
    return <p className="px-6 py-20 text-center text-sm text-white/35">Opening Mood Universe…</p>;
  }

  const identity = snap.identity;

  function commit(mood: BuddyMood) {
    const next = recordBuddyCheckIn(mood);
    setSnap(next);
    setSelected(mood);
    setAskWhy(true);
    setNote("");
    setReply(checkInReply(mood));
    setInteraction(interactionFromWake(mood));
    window.setTimeout(() => setInteraction("idle"), 2200);
    void notifySoul("mood_shared", mood);
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg flex-col items-center px-6 pb-24 pt-4 text-center">
      <BuddyOrb
        mood={state.mood}
        size={180}
        world="mood"
        aura={identity.auraId}
        animation={identity.animation}
        seasonal={identity.auraId === "seasonal-veil" ? seasonalVeilId() : undefined}
        interaction={interaction}
        valence={state.valence}
        arousal={state.arousal}
        energy={(state.arousal ?? 0.45) > 0.7 ? "vibrant" : (state.arousal ?? 0.45) < 0.35 ? "resting" : "present"}
        evolutionClass={evolutionClassName(stage)}
        reducedMotion={reduce}
      />
      <h1 className="mt-8 text-xl font-light text-white">Mood Universe</h1>
      <p className="mt-2 text-sm text-white/45">Your emotional journey, as a sky — not a chart.</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/30">
        {tierLabel} · {historyDays}-day window · check-ins stay on this device
      </p>
      <p className="mt-3 text-[11px] text-white/40">
        {EVOLUTION_LABEL[stage]} — {evolutionHint(stage)}
      </p>
      {snap.vibe ? (
        <p className="mt-4 text-sm text-white/70">
          {snap.vibe.title}
          <span className="mt-1 block text-xs text-white/35">{snap.vibe.line}</span>
          <span className="mt-1 block text-[11px] text-white/25">Playful snapshot — not a diagnosis.</span>
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Mood history range">
        {(
          [
            ["today", "Today"],
            ["7d", "7 days"],
            ["30d", "30 days"],
            ["all", "Constellation"],
          ] as const
        ).map(([id, label]) => {
          const locked = (id === "30d" || id === "all") && historyDays < 30;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={range === id}
              disabled={locked}
              onClick={() => setRange(id)}
              className={`min-h-11 rounded-full border px-3 text-xs ${
                range === id ? "border-white/35 text-white" : "border-white/10 text-white/45"
              } disabled:opacity-30`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-8 w-full">
        <MoodPicker selected={selected} onSelect={commit} />
      </div>
      {reply ? <p className="mt-4 text-sm text-white/60">{reply}</p> : null}
      {moment ? <p className="mt-3 text-sm text-white/50">{moment.line}</p> : null}
      {askWhy ? (
        <form
          className="mt-6 w-full"
          onSubmit={(e) => {
            e.preventDefault();
            recordCheckInNote(note);
            setSnap(loadUniverse());
            setNote("");
            setAskWhy(false);
          }}
        >
          <label className="block text-sm text-white/55" htmlFor="mood-why">
            Want to tell me why?
          </label>
          <input
            id="mood-why"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            placeholder="Optional"
          />
          <button type="submit" className="mt-3 min-h-11 px-3 text-xs text-white/40 hover:text-white/70">
            Save note
          </button>
        </form>
      ) : null}
      <p className="mt-8 text-sm text-white/60">{insightLine(state)}</p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-white/30">Based on what you shared · not medical advice</p>
      <MoodConstellation entries={visible} />
      {UNIVERSE_FLAGS.vibeProfile && snap.vibe && snap.vibe.id !== "still-forming" ? (
        <div className="mt-8 w-full">
          <ShareCard kind="vibe" title={snap.vibe.title} line={snap.vibe.line} />
        </div>
      ) : null}
      {sharePremium && weekDays >= 3 ? (
        <div className="mt-4 w-full">
          <ShareCard
            kind="week"
            title={`${weekDays} days with Buddy`}
            line="A small constellation of showing up. No private notes included."
          />
        </div>
      ) : null}
      <ul className="mt-10 w-full space-y-3 text-left text-sm text-white/55">
        {visible.length === 0 ? <li className="text-white/35">No check-ins yet. The sky is waiting.</li> : null}
        {visible.map((row) => (
          <li key={row.id} className="border-b border-white/5 pb-2 capitalize">
            {row.mood}
            <span className="ml-2 text-white/30">{new Date(row.createdAt).toLocaleString()}</span>
            {row.note ? <span className="mt-1 block text-white/40">{row.note}</span> : null}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-8 text-xs text-rose-200/60 hover:text-rose-100"
        onClick={() => {
          if (!window.confirm("Delete all local mood check-ins on this device?")) return;
          clearCheckIns();
          setSnap(loadUniverse());
        }}
      >
        Delete local mood history
      </button>
      {historyDays <= 7 ? (
        <p className="mt-4 text-xs text-white/35">
          Free history shows about a week.{" "}
          <a href="/pricing" className="text-white/55 underline-offset-2 hover:underline">
            Unlock more memory
          </a>
        </p>
      ) : null}
      <WorldPortal href="/dashboard/oracle" hint="Oracle Realm" label="Ask the quieter sky" />
    </main>
  );
}
