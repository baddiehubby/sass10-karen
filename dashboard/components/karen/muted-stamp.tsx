"use client";

/**
 * Full-screen manga MUTED stamp — TikTok-bait drama when Karen kills the mic.
 */

import { AnimatePresence, motion } from "framer-motion";

type MutedStampProps = {
  show: boolean;
};

export function MutedStamp({ show }: MutedStampProps) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="muted-stamp-fullscreen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center"
          aria-live="assertive"
          data-karen-muted-stamp-fullscreen=""
        >
          {/* Red screen flash */}
          <motion.div
            className="absolute inset-0 bg-red-600/45 mix-blend-multiply"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.55, 0.9, 0.35] }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            aria-hidden
          />

          <motion.div
            initial={{ scale: 2.4, rotate: -28, opacity: 0, y: -40 }}
            animate={{ scale: 1, rotate: -14, opacity: 1, y: 0 }}
            exit={{ scale: 1.2, opacity: 0, rotate: -8 }}
            transition={{ type: "spring", stiffness: 420, damping: 16, mass: 0.85 }}
            className="relative px-4"
          >
            <p
              className="select-none text-center text-[clamp(4.5rem,22vw,9rem)] font-black uppercase leading-none tracking-[-0.04em] text-red-500"
              style={{
                WebkitTextStroke: "4px #fff",
                paintOrder: "stroke fill",
                textShadow:
                  "0 0 0 #000, 8px 8px 0 #000, -4px 4px 0 #7f1d1d, 0 0 40px rgba(255,0,40,0.85)",
                transform: "skewX(-8deg)",
              }}
            >
              MUTED
            </p>
            <p
              className="mt-3 text-center text-[11px] font-black uppercase tracking-[0.45em] text-white"
              style={{ textShadow: "0 2px 12px #000" }}
            >
              She stopped listening
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
