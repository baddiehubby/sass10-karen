"use client";

/**
 * Persistent Buddie presence for authenticated dashboard shell.
 * Reuses BuddyOrb only — no second intelligence implementation.
 * Hidden on routes that already mount a full-page orb (home / mood / oracle).
 */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BuddyOrb } from "@/components/buddy-orb";
import { loadIdentity, type AnimationPersonality, type AuraId } from "@/lib/buddy-identity";
import { deriveMoodState, mapLegacyMood, type BuddyMood, type MoodState } from "@/lib/companion-mood";
import { effectiveReducedMotion, loadCheckIns } from "@/lib/mood-memory";
import { seasonalVeilId } from "@/lib/orb-evolution";
import { checkInReply } from "@/lib/buddy-universe";
import { evolutionClassName, reconcileEvolutionStage } from "@/lib/buddy-evolution";
import { interactionFromWake, type OrbInteraction } from "@/lib/orb-state";

/** Routes that already render a primary BuddyOrb — avoid a second instance. */
function hasPrimaryOrb(pathname: string): boolean {
  if (pathname === "/dashboard") return true;
  if (pathname.startsWith("/dashboard/mood")) return true;
  if (pathname.startsWith("/dashboard/oracle")) return true;
  return false;
}

export function DashboardPersistentPresence() {
  const pathname = usePathname() ?? "/dashboard";
  const router = useRouter();
  const [liveMood, setLiveMood] = useState<BuddyMood>("calm");
  const [aura, setAura] = useState<AuraId>("ember");
  const [animation, setAnimation] = useState<AnimationPersonality>("soft");
  const [evolutionClass, setEvolutionClass] = useState("orb-awakening");
  const [interaction, setInteraction] = useState<OrbInteraction>("idle");
  const [affect, setAffect] = useState<{ valence?: number; arousal?: number }>({});
  const [reduce, setReduce] = useState(false);
  const [wake, setWake] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const entries = loadCheckIns();
      const identity = loadIdentity();
      const state: MoodState = entries.length
        ? deriveMoodState(entries)
        : {
            mood: mapLegacyMood("—"),
            intensity: 40,
            trend: "steady",
            confidence: 0.2,
            valence: 0,
            arousal: 0.4,
          };
      setLiveMood(state.mood);
      setAffect({ valence: state.valence, arousal: state.arousal });
      setAura(identity.auraId);
      setAnimation(identity.animation);
      setReduce(effectiveReducedMotion());
      setEvolutionClass(evolutionClassName(reconcileEvolutionStage(entries)));
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

  if (hasPrimaryOrb(pathname)) {
    // #region agent log
    fetch("http://127.0.0.1:7611/ingest/87ee683e-41c7-4485-9b1b-9c00188d4aac", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f590a1" },
      body: JSON.stringify({
        sessionId: "f590a1",
        runId: "presence-verify",
        hypothesisId: "P1",
        location: "dashboard-persistent-presence.tsx:hide",
        message: "floating presence hidden — primary orb route",
        data: { pathname },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return null;
  }

  // #region agent log
  fetch("http://127.0.0.1:7611/ingest/87ee683e-41c7-4485-9b1b-9c00188d4aac", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f590a1" },
    body: JSON.stringify({
      sessionId: "f590a1",
      runId: "presence-verify",
      hypothesisId: "P1",
      location: "dashboard-persistent-presence.tsx:show",
      message: "floating presence visible",
      data: { pathname, mood: liveMood },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return (
    <div
      className="pointer-events-none fixed z-40"
      style={{
        right: "max(1rem, env(safe-area-inset-right, 0px))",
        bottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
      }}
      aria-live="polite"
    >
      <div className="pointer-events-auto flex flex-col items-center gap-1">
        <BuddyOrb
          mood={liveMood}
          size={88}
          label="Buddie companion"
          aura={aura}
          animation={animation}
          world="buddy"
          seasonal={aura === "seasonal-veil" ? seasonalVeilId() : undefined}
          evolutionClass={evolutionClass}
          interaction={interaction}
          valence={affect.valence}
          arousal={affect.arousal}
          energy={
            (affect.arousal ?? 0.45) > 0.7
              ? "vibrant"
              : (affect.arousal ?? 0.45) < 0.35
                ? "resting"
                : "present"
          }
          reducedMotion={reduce}
          onActivate={() => {
            setWake(checkInReply(liveMood));
            setInteraction(interactionFromWake(liveMood));
            window.setTimeout(() => setInteraction("idle"), 2200);
            router.push("/dashboard");
          }}
        />
        {wake ? (
          <p className="max-w-[9rem] text-center text-[10px] leading-snug text-white/50" role="status">
            {wake}
          </p>
        ) : null}
      </div>
    </div>
  );
}
