"use client";

import Link from "next/link";
import { BuddyOrb } from "@/components/buddy-orb";
import { ShareCard } from "@/components/share-card";
import type { AnimationPersonality, AuraId } from "@/lib/buddy-identity";
import type { MoodState } from "@/lib/companion-mood";
import type { OracleReading } from "@/lib/oracle/engine";
import { seasonalVeilId } from "@/lib/orb-evolution";

type OracleExperienceProps = {
  state: MoodState;
  reading: OracleReading;
  advancedOracle: boolean;
  tierLabel: string;
  aura: AuraId;
  animation: AnimationPersonality;
  unlockTitle: string | null;
  revealed: boolean;
  onReveal: () => void;
  onToggleStyle: () => void;
};

export function OracleExperience({
  state,
  reading,
  advancedOracle,
  tierLabel,
  aura,
  animation,
  unlockTitle,
  revealed,
  onReveal,
  onToggleStyle,
}: OracleExperienceProps) {
  return (
    <section className={`oracle-stage mx-auto w-full max-w-lg px-6 pb-24 pt-2 text-center ${revealed ? "oracle-revealed" : "oracle-veiled"}`}>
      <div className="oracle-stars" aria-hidden />
      <BuddyOrb
        mood={state.mood}
        size={176}
        label="Oracle companion"
        world="oracle"
        aura={aura}
        animation={animation}
        seasonal={aura === "seasonal-veil" ? seasonalVeilId() : undefined}
        interaction="oracle"
        valence={state.valence}
        arousal={state.arousal}
      />
      {unlockTitle ? (
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-cyan-200/70">A new look found you · {unlockTitle}</p>
      ) : null}

      {!revealed ? (
        <div className="mt-10">
          <p className="text-sm text-white/50">The Realm is listening.</p>
          <button
            type="button"
            onClick={onReveal}
            className="mt-6 min-h-12 rounded-full border border-white/20 bg-white/10 px-6 text-sm text-white"
          >
            Reveal today&apos;s reflection
          </button>
          <p className="mt-4 text-[11px] text-white/30">Entertainment and symbolism — not prediction.</p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-[11px] uppercase tracking-[0.28em] text-white/35">{reading.energyLabel}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/25">{tierLabel}</p>
          <h1 className="mt-2 text-2xl font-light tracking-wide text-white oracle-symbol">{reading.sign}</h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">{reading.energy}</p>

          <div className="mt-8">
            <ShareCard kind="oracle" title={reading.sign} line={reading.energy} />
          </div>

          <div className="mt-8 space-y-4 text-left text-sm text-white/70">
            <OracleCard title="What may come into focus" body={reading.focus} />
            <OracleCard title="What to notice" body={reading.notice} />
            <OracleCard title="Your reflection" body={reading.reflection} />
            <OracleCard title="Your next move" body={reading.nextMove} />
            <OracleCard title="A symbol for today" body={`Lucky element: ${reading.sign.split(" ").slice(-1)[0] || "light"}`} />
            {advancedOracle ? (
              <>
                <OracleCard title="Love" body={reading.love} />
                <OracleCard title="Career" body={reading.career} />
                <OracleCard title="Money" body={reading.money} />
                <OracleCard title="Friendships" body={reading.friendships} />
                <OracleCard title="Personal growth" body={reading.growth} />
                <OracleCard title="Tomorrow" body={reading.tomorrow} />
                <OracleCard title="Week ahead" body={reading.weekAhead} />
              </>
            ) : (
              <p className="pt-2 text-center text-xs text-white/35">
                Deeper reflections unlock with Pro or Premium.{" "}
                <Link href="/pricing" className="text-white/55 underline-offset-2 hover:underline">
                  See plans
                </Link>
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onToggleStyle}
              className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-xs text-white/70 hover:border-white/30"
            >
              {reading.style === "pandit" ? "Cosmic mode" : "Pandit-inspired mode"}
            </button>
          </div>
          <p className="mt-6 text-[11px] leading-relaxed text-white/30">{reading.disclaimer}</p>
        </>
      )}
    </section>
  );
}

function OracleCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
      <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/40">{title}</h2>
      <p className="mt-2 font-light text-white/80">{body}</p>
    </article>
  );
}
