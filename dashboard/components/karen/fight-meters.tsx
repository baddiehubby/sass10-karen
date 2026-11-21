"use client";

/**
 * Fighting-game HUD — Dignity (player, top-left, blue) + Patience (Karen, top-right, red).
 * Framer Motion drains the fill; a delayed ghost trail shows the chunk that just dropped.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import {
  FIGHT_CHAOS_DIGNITY_THRESHOLD,
  KAREN_COUNTER_DAMAGE_MIN,
  KAREN_PATIENCE_START,
  USER_DIGNITY_START,
  USER_HIT_DAMAGE_MIN,
} from "@/lib/karen/game-state";

export {
  FIGHT_CHAOS_DIGNITY_THRESHOLD,
  KAREN_PATIENCE_START as FIGHT_PATIENCE_START,
  USER_DIGNITY_START as FIGHT_DIGNITY_START,
};
/** Landed scream floor — HUD still labels this as a Patience hit. */
export const FIGHT_PATIENCE_HIT = USER_HIT_DAMAGE_MIN;
/** Karen WAV counter floor. */
export const FIGHT_DIGNITY_HIT = KAREN_COUNTER_DAMAGE_MIN;
/** Hold-mic interrupt also counts as a roast hit. */
export const FIGHT_DIGNITY_HOLD_INTERRUPT = FIGHT_DIGNITY_HIT;
/** Patience 0% → MUTED stamp + no responses for this long. */
export const FIGHT_PATIENCE_MUTE_MS = 30_000;
/** After a 30s patience mute, give her a little Patience back. */
export const FIGHT_PATIENCE_RECOVER = 40;

const BAR_EASE = [0.22, 1, 0.36, 1] as const;

type FightBarProps = {
  label: string;
  fighter: string;
  side: "left" | "right";
  value: number;
  accent: string;
  trail: string;
};

function FightBar({ label, fighter, side, value, accent, trail }: FightBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const [ghost, setGhost] = useState(pct);
  const critical = pct <= 20;
  const low = pct <= 40;
  const right = side === "right";

  useEffect(() => {
    if (pct >= ghost) {
      setGhost(pct);
      return;
    }
    const t = window.setTimeout(() => setGhost(pct), 240);
    return () => window.clearTimeout(t);
  }, [pct, ghost]);

  return (
    <div
      className={`pointer-events-none min-w-0 w-[46%] max-w-[280px] ${
        right ? "text-right ml-auto" : "text-left mr-auto"
      }`}
      aria-label={`${label} ${pct} percent`}
      data-karen-fight-bar={label.toLowerCase()}
    >
      <div
        className={`mb-1 flex items-baseline gap-2 ${
          right ? "flex-row-reverse" : "flex-row"
        }`}
      >
        <p
          className="text-[9px] font-black uppercase tracking-[0.32em]"
          style={{
            color: accent,
            textShadow: "0 1px 8px rgba(0,0,0,0.95)",
          }}
        >
          {fighter}
        </p>
        <p
          className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70"
          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.95)" }}
        >
          {label}
        </p>
        <p
          className={`text-[11px] font-black tabular-nums tracking-wider ${
            critical ? "text-red-400" : low ? "text-white" : "text-white/85"
          }`}
          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.95)" }}
        >
          {pct}%
        </p>
      </div>
      <div className="relative h-3.5 overflow-hidden rounded-[3px] border border-white/20 bg-black/75 shadow-[inset_0_0_14px_rgba(0,0,0,0.8)]">
        <motion.div
          className="absolute inset-y-0"
          style={{
            background: trail,
            left: right ? "auto" : 0,
            right: right ? 0 : "auto",
            opacity: 0.45,
          }}
          initial={false}
          animate={{ width: `${ghost}%` }}
          transition={{ duration: 0.55, ease: BAR_EASE }}
        />
        <motion.div
          className="absolute inset-y-0"
          style={{
            background: critical
              ? `linear-gradient(90deg,#7f1d1d,${accent},#ffffff)`
              : `linear-gradient(90deg,#0b1220,${accent})`,
            boxShadow: low ? `0 0 18px ${accent}` : `0 0 10px ${accent}88`,
            left: right ? "auto" : 0,
            right: right ? 0 : "auto",
          }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.38, ease: BAR_EASE }}
        />
      </div>
      {critical ? (
        <motion.p
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 0.7, repeat: Infinity }}
          className="mt-1 text-[9px] font-black uppercase tracking-[0.22em] text-red-400"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}
        >
          {right ? "Breaking" : "Ego critical"}
        </motion.p>
      ) : null}
    </div>
  );
}

type FightMetersProps = {
  dignity: number;
  patience: number;
  className?: string;
};

export function FightMeters({
  dignity,
  patience,
  className = "",
}: FightMetersProps) {
  return (
    <div
      className={`pointer-events-none flex w-full items-start justify-between gap-4 ${className}`.trim()}
      data-karen-fight-meters=""
    >
      <FightBar
        label="Dignity"
        fighter="YOU"
        side="left"
        value={dignity}
        accent="#3b82f6"
        trail="#93c5fd"
      />
      <FightBar
        label="Patience"
        fighter="KAREN"
        side="right"
        value={patience}
        accent="#ff2d55"
        trail="#fb7185"
      />
    </div>
  );
}
