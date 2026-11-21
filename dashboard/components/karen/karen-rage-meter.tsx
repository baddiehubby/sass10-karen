"use client";

import { motion } from "framer-motion";

type KarenRageMeterProps = {
  /** 0–100 */
  value: number;
  className?: string;
};

/**
 * Top-of-stage "KAREN'S RAGE" — fills as the user argues back.
 * At 100% the chat client trips Mute Protocol (hang-up).
 */
export function KarenRageMeter({ value, className = "" }: KarenRageMeterProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const hot = pct >= 70;
  const critical = pct >= 90;

  return (
    <div
      className={`pointer-events-none w-full max-w-xs ${className}`.trim()}
      data-karen-rage-meter=""
      aria-label={`Karen's rage ${pct} percent`}
    >
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p
          className="text-[10px] font-black uppercase tracking-[0.35em] text-red-300"
          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.95)" }}
        >
          Karen&apos;s Rage
        </p>
        <p
          className={`text-[11px] font-black tabular-nums tracking-wider ${
            critical ? "text-red-400" : hot ? "text-rose-300" : "text-white/80"
          }`}
          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.95)" }}
        >
          {pct}%
        </p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-white/20 bg-black/55 shadow-[inset_0_0_12px_rgba(0,0,0,0.65)]">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: critical
              ? "linear-gradient(90deg,#7f1d1d,#ff1a3c,#ff4d6d)"
              : hot
                ? "linear-gradient(90deg,#9b0018,#ff2d55)"
                : "linear-gradient(90deg,#4c0519,#ff1a3c)",
            boxShadow: hot
              ? "0 0 16px rgba(255,45,85,0.75)"
              : "0 0 8px rgba(255,45,85,0.35)",
          }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
        />
      </div>
      {critical ? (
        <p
          className="mt-1 text-[9px] font-bold uppercase tracking-[0.28em] text-red-400/90"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}
        >
          Hang-up imminent
        </p>
      ) : null}
    </div>
  );
}
