"use client";

import { motion, useAnimationControls } from "framer-motion";
import { useEffect } from "react";

export type KarenAvatarMood = string | null | undefined;

type KarenAvatarProps = {
  mood?: KarenAvatarMood;
  isSpeaking?: boolean;
  className?: string;
};

function normalizeMood(mood: KarenAvatarMood): string {
  return (mood ?? "ANNOYED").toString().toUpperCase();
}

function moodPalette(mood: string) {
  switch (mood) {
    case "ANGRY":
    case "FURIOUS":
      return {
        core: "from-rose-500 via-red-600 to-red-950",
        glow: "rgba(239,68,68,0.55)",
        ring: "ring-red-400/70",
        label: mood === "FURIOUS" ? "FURIOUS" : "ANGRY",
      };
    case "SARCASTIC":
      return {
        core: "from-fuchsia-400 via-pink-500 to-rose-700",
        glow: "rgba(236,72,153,0.5)",
        ring: "ring-pink-400/60",
        label: "SARCASTIC",
      };
    case "PROUD":
    case "SWEET":
      return {
        core: "from-pink-300 via-rose-400 to-fuchsia-700",
        glow: "rgba(244,114,182,0.45)",
        ring: "ring-pink-300/50",
        label: mood,
      };
    case "ANNOYED":
    default:
      return {
        core: "from-orange-400 via-rose-500 to-red-800",
        glow: "rgba(249,115,22,0.4)",
        ring: "ring-orange-400/40",
        label: "ANNOYED",
      };
  }
}

/**
 * Polished 2D Karen stage avatar (Framer Motion).
 * Swap for 3D/GLB later without changing the chat shell.
 */
export function KarenAvatar({ mood, isSpeaking = false, className = "" }: KarenAvatarProps) {
  const key = normalizeMood(mood);
  const palette = moodPalette(key);
  const controls = useAnimationControls();
  const isAngry = key === "ANGRY" || key === "FURIOUS";
  const isSarcastic = key === "SARCASTIC";

  useEffect(() => {
    if (isAngry) {
      void controls.start({
        x: [0, -6, 7, -5, 4, -2, 0],
        rotate: [0, -2, 2.5, -1.5, 1, 0],
        transition: { duration: 0.45, ease: "easeInOut" },
      });
    } else if (isSarcastic) {
      void controls.start({
        rotate: [0, -7, -5],
        transition: { duration: 0.55, ease: "easeOut" },
      });
    } else {
      void controls.start({
        rotate: 0,
        x: 0,
        transition: { type: "spring", stiffness: 260, damping: 22 },
      });
    }
  }, [controls, isAngry, isSarcastic, key]);

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {/* Ambient stage glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 h-48 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${palette.glow} 0%, transparent 70%)` }}
        aria-hidden
      />

      <motion.div
        animate={controls}
        className="relative"
        style={{ transformOrigin: "50% 70%" }}
      >
        <motion.div
          className={`relative h-36 w-36 rounded-full bg-gradient-to-br ${palette.core} ring-2 ${palette.ring} sm:h-44 sm:w-44`}
          style={{
            boxShadow: `0 0 48px ${palette.glow}, inset 0 0 40px rgba(0,0,0,0.25)`,
          }}
          animate={
            isAngry
              ? {
                  scale: [1, 1.06, 1],
                  boxShadow: [
                    `0 0 32px ${palette.glow}`,
                    `0 0 64px rgba(239,68,68,0.85)`,
                    `0 0 40px ${palette.glow}`,
                  ],
                }
              : isSpeaking
                ? { scale: [1, 1.03, 1] }
                : { scale: 1 }
          }
          transition={
            isAngry
              ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" }
              : isSpeaking
                ? { duration: 0.55, repeat: Infinity, ease: "easeInOut" }
                : { type: "spring", stiffness: 200, damping: 20 }
          }
        >
          {/* Glass sheen */}
          <div className="absolute inset-[12%] rounded-full bg-gradient-to-br from-white/25 via-transparent to-black/30 backdrop-blur-[2px]" />
          {/* Face accents */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex w-[52%] flex-col items-center gap-3">
              <div className="flex w-full justify-between px-1">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-950/80" />
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-950/80" />
              </div>
              <motion.div
                className="h-1 w-8 rounded-full bg-zinc-950/70"
                animate={
                  isSpeaking
                    ? { scaleX: [1, 1.35, 0.85, 1.2, 1], scaleY: [1, 1.8, 0.7, 1.4, 1] }
                    : { scaleX: 1, scaleY: 1 }
                }
                transition={
                  isSpeaking
                    ? { duration: 0.4, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.2 }
                }
              />
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.p
        key={palette.label}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 text-[11px] font-semibold tracking-[0.28em] text-rose-300/90"
      >
        [{palette.label}]
        {isSpeaking ? " · LIVE" : ""}
      </motion.p>
    </div>
  );
}
