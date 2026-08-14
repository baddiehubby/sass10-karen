"use client";

import { useEffect, useMemo, useState } from "react";
import { OracleExperience } from "@/components/oracle-experience";
import type { MoodCheckIn } from "@/lib/companion-mood";
import { defaultIdentity, type BuddyIdentity } from "@/lib/buddy-identity";
import { freshUnlockTitle, recordOracleVisit } from "@/lib/buddy-universe";
import { loadCheckIns, loadOracleStyle, saveOracleStyle, type OracleStyle } from "@/lib/mood-memory";
import { buildOracleReading } from "@/lib/oracle/engine";
import { notifySoul } from "@/lib/buddy-soul-client";
import { UNIVERSE_FLAGS } from "@/lib/universe-flags";

type OracleClientProps = {
  advancedOracle: boolean;
  tierLabel: string;
};

type Phase = "portal" | "orb" | "reveal";

export function OracleClient({ advancedOracle, tierLabel }: OracleClientProps) {
  const [checkIns, setCheckIns] = useState<MoodCheckIn[]>([]);
  const [style, setStyle] = useState<OracleStyle>("cosmic");
  const [identity, setIdentity] = useState<BuddyIdentity>(() => defaultIdentity());
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("portal");

  useEffect(() => {
    if (!UNIVERSE_FLAGS.oracleRealm) return;
    setCheckIns(loadCheckIns());
    setStyle(loadOracleStyle());
    setIdentity(recordOracleVisit());
    void notifySoul("oracle_consulted");
    setReady(true);
    const t = window.setTimeout(() => setPhase("orb"), 700);
    return () => window.clearTimeout(t);
  }, []);

  const { state, reading } = useMemo(() => buildOracleReading(checkIns, style), [checkIns, style]);

  if (!UNIVERSE_FLAGS.oracleRealm) {
    return <p className="px-6 py-20 text-center text-sm text-white/35">Oracle Realm is paused.</p>;
  }

  if (!ready) {
    return <p className="px-6 py-20 text-center text-sm text-white/35">Opening the Realm…</p>;
  }

  if (phase === "portal") {
    return (
      <section className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Oracle Realm</p>
        <p className="mt-4 text-lg font-light text-white/80">The quieter world opens…</p>
        <p className="mt-3 max-w-sm text-xs text-white/35">Reflection and symbolism — not fate or medicine.</p>
      </section>
    );
  }

  return (
    <OracleExperience
      state={state}
      reading={reading}
      advancedOracle={advancedOracle}
      tierLabel={tierLabel}
      aura={identity.auraId}
      animation={identity.animation}
      unlockTitle={freshUnlockTitle(identity)}
      revealed={phase === "reveal"}
      onReveal={() => setPhase("reveal")}
      onToggleStyle={() => {
        const next = style === "cosmic" ? "pandit" : "cosmic";
        saveOracleStyle(next);
        setStyle(next);
      }}
    />
  );
}
