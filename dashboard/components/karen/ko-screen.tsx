"use client";

/**
 * Fighting-game K.O. — grayscale wash + giant red stamp slam.
 * Dignity 0% ends the round. Paywall follows after the stamp lands.
 */

import { AnimatePresence, motion } from "framer-motion";

type KoScreenProps = {
  show: boolean;
  /** "user" = you got flattened. "karen" unused visually (share card owns that win). */
  loser?: "user" | "karen";
};

export function KoScreen({ show, loser = "user" }: KoScreenProps) {
  if (!show) return null;

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="ko-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed inset-0 z-[96] flex items-center justify-center"
          aria-live="assertive"
          data-karen-ko=""
          data-karen-ko-loser={loser}
        >
          {/* Black-and-white crush over the 3D avatar */}
          <motion.div
            className="absolute inset-0 bg-black/40"
            style={{
              backdropFilter: "grayscale(1) contrast(1.25) brightness(0.72)",
              WebkitBackdropFilter: "grayscale(1) contrast(1.25) brightness(0.72)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.28 }}
            aria-hidden
          />
          <motion.div
            className="absolute inset-0 bg-red-700/25 mix-blend-multiply"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0.35, 0.55] }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            aria-hidden
          />

          <motion.div
            initial={{ scale: 3.2, rotate: -32, opacity: 0, y: -80 }}
            animate={{ scale: 1, rotate: -12, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 460, damping: 14, mass: 0.8 }}
            className="relative px-4"
          >
            <p
              className="select-none text-center text-[clamp(5.5rem,28vw,11rem)] font-black uppercase leading-none tracking-[-0.06em] text-red-500"
              style={{
                WebkitTextStroke: "6px #fff",
                paintOrder: "stroke fill",
                textShadow:
                  "0 0 0 #000, 10px 10px 0 #000, -5px 5px 0 #7f1d1d, 0 0 48px rgba(255,0,40,0.9)",
                transform: "skewX(-10deg)",
              }}
            >
              K.O.
            </p>
            <p
              className="mt-3 text-center text-[12px] font-black uppercase tracking-[0.5em] text-white"
              style={{ textShadow: "0 2px 14px #000" }}
            >
              Dignity destroyed
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
