"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function formatRecTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

type CinematicOverlayProps = {
  /** Show the REC timecode badge (default true). */
  showRec?: boolean;
  /** Extra class on the root overlay stack. */
  className?: string;
};

/**
 * Film polish only.
 * CRITICAL: parent AND every child must be pointer-events-none.
 * CSS does not inherit pointer-events — a child with default `auto` will
 * steal mic/quiz clicks even when the parent is none.
 */
export function CinematicOverlay({
  showRec = true,
  className = "",
}: CinematicOverlayProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[15] overflow-hidden ${className}`}
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 100px rgba(0,0,0,0.55)", pointerEvents: "none" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.35) 100%)",
          pointerEvents: "none",
        }}
      />

      <motion.div
        className="karen-film-grain pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{ pointerEvents: "none" }}
        animate={{ opacity: [0.08, 0.16, 0.1, 0.18, 0.08] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
      />

      {showRec ? (
        <div
          className="pointer-events-none absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.65rem,env(safe-area-inset-top))] z-[1] flex items-center gap-2 rounded border border-red-500/35 bg-black/55 px-2.5 py-1.5 backdrop-blur-md"
          style={{
            pointerEvents: "none",
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            textShadow: "0 0 10px rgba(239,68,68,0.45), 0 1px 2px rgba(0,0,0,0.9)",
          }}
        >
          <motion.span
            className="pointer-events-none inline-block h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.95)]"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="pointer-events-none text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">
            REC
          </span>
          <span className="pointer-events-none text-[10px] font-semibold tabular-nums tracking-wider text-red-200/90">
            | {formatRecTime(elapsed)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default CinematicOverlay;
