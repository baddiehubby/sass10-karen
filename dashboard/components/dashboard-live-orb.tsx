"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { BuddyOrb } from "@/components/buddy-orb";
import { loadIdentity, type AnimationPersonality, type AuraId } from "@/lib/buddy-identity";
import { deriveMoodState, mapLegacyMood, type BuddyMood, type MoodState } from "@/lib/companion-mood";
import { effectiveReducedMotion, loadCheckIns } from "@/lib/mood-memory";
import { seasonalVeilId } from "@/lib/orb-evolution";
import { checkInReply } from "@/lib/buddy-universe";
import { subscribeSoul } from "@/lib/buddy-soul-client";
import type { PublicBond } from "@/lib/buddy-soul-types";
import { evolutionClassName, reconcileEvolutionStage } from "@/lib/buddy-evolution";
import { interactionFromWake, type OrbInteraction } from "@/lib/orb-state";

type DashboardLiveOrbProps = {
  mood: string;
  licenseKey: string | null;
  scriptUrl: string;
  apiBase: string;
  audioPulse?: number;
  onActivate?: () => void;
};

export function DashboardLiveOrb({
  mood,
  licenseKey,
  scriptUrl,
  apiBase,
  audioPulse = 0,
  onActivate,
}: DashboardLiveOrbProps) {
  const fallback = mapLegacyMood(mood);
  const [liveMood, setLiveMood] = useState<BuddyMood>(fallback);
  const [aura, setAura] = useState<AuraId>("ember");
  const [animation, setAnimation] = useState<AnimationPersonality>("soft");
  const [wake, setWake] = useState<string | null>(null);
  const [evolutionClass, setEvolutionClass] = useState("orb-awakening");
  const [soulLine, setSoulLine] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<OrbInteraction>("idle");
  const [affect, setAffect] = useState<{ valence?: number; arousal?: number }>({});
  const [reduce, setReduce] = useState(false);
  const [stageLabel, setStageLabel] = useState("Awakening");

  useEffect(() => {
    const sync = () => {
      const entries = loadCheckIns();
      const identity = loadIdentity();
      const state: MoodState = entries.length
        ? deriveMoodState(entries)
        : { mood: mapLegacyMood(mood), intensity: 40, trend: "steady", confidence: 0.2, valence: 0, arousal: 0.4 };
      setLiveMood(state.mood);
      setAffect({ valence: state.valence, arousal: state.arousal });
      setAura(identity.auraId);
      setAnimation(identity.animation);
      setReduce(effectiveReducedMotion());
      const stage = reconcileEvolutionStage(entries);
      setEvolutionClass(evolutionClassName(stage));
      setStageLabel(stage.charAt(0).toUpperCase() + stage.slice(1));
    };
    sync();
    window.addEventListener("buddy-mood-changed", sync);
    window.addEventListener("buddy-universe-changed", sync);
    window.addEventListener("buddy-prefs-changed", sync);
    const unsub = subscribeSoul((bond: PublicBond) => {
      if (!bond.available) return;
      const entries = loadCheckIns();
      const stage = reconcileEvolutionStage(entries, bond.evolutionStage);
      setEvolutionClass(evolutionClassName(stage));
      setStageLabel(bond.stageLabel);
      if (bond.moment) setSoulLine(bond.moment);
    });
    return () => {
      window.removeEventListener("buddy-mood-changed", sync);
      window.removeEventListener("buddy-universe-changed", sync);
      window.removeEventListener("buddy-prefs-changed", sync);
      unsub();
    };
  }, [mood]);

  const size = Math.round(220 * (1 + Math.min(0.08, audioPulse * 0.12)));

  return (
    <div className="relative mx-auto flex min-h-[240px] w-full flex-col items-center justify-center">
      {licenseKey ? (
        <Script
          src={scriptUrl}
          data-hq-key={licenseKey}
          data-hq-api={apiBase}
          data-hq-css={`${apiBase}/widget/buddy-widget.css`}
          strategy="afterInteractive"
        />
      ) : null}
      <BuddyOrb
        mood={liveMood}
        size={size}
        label="Buddy companion"
        aura={aura}
        animation={animation}
        world="buddy"
        seasonal={aura === "seasonal-veil" ? seasonalVeilId() : undefined}
        evolutionClass={evolutionClass}
        interaction={interaction}
        valence={affect.valence}
        arousal={affect.arousal}
        energy={(affect.arousal ?? 0.45) > 0.7 ? "vibrant" : (affect.arousal ?? 0.45) < 0.35 ? "resting" : "present"}
        reducedMotion={reduce}
        onActivate={() => {
          setWake(checkInReply(liveMood));
          setInteraction(interactionFromWake(liveMood));
          window.setTimeout(() => setInteraction("idle"), 2200);
          onActivate?.();
        }}
      />
      <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-white/30" aria-live="polite">
        {stageLabel}
      </p>
      {soulLine ? <p className="mt-3 max-w-sm text-sm font-light text-white/60">{soulLine}</p> : null}
      {wake ? (
        <p className="mt-3 text-sm text-white/55" role="status">
          {wake}
        </p>
      ) : null}
    </div>
  );
}
