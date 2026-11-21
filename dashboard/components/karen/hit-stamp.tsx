"use client";

/**
 * Manga-style hit popup — masks minor audio latency on SEND.
 */

import { AnimatePresence, motion } from "framer-motion";

type HitStampProps = {
  show: boolean;
  /** Glyph / mark — 💥 or !! */
  mark?: string;
};

export function HitStamp({ show, mark = "💥" }: HitStampProps) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key={`hit-stamp-${mark}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.08 }}
          className="pointer-events-none fixed inset-0 z-[94] flex items-center justify-center"
          aria-hidden
          data-karen-hit-stamp=""
        >
          <motion.div
            className="absolute inset-0 bg-red-600/35"
            initial={{ opacity: 0.45 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "linear" }}
          />
          <motion.p
            initial={{ scale: 2.8, rotate: -18, opacity: 0 }}
            animate={{ scale: 1, rotate: -8, opacity: 1 }}
            exit={{ scale: 1.4, opacity: 0, rotate: 4 }}
            transition={{ type: "spring", stiffness: 520, damping: 14, mass: 0.7 }}
            className="select-none text-center font-black leading-none"
            style={{
              fontSize: "clamp(5rem, 28vw, 11rem)",
              color: "#ff2d55",
              WebkitTextStroke: "5px #fff",
              paintOrder: "stroke fill",
              textShadow:
                "0 0 0 #000, 10px 10px 0 #000, -5px 5px 0 #7f1d1d, 0 0 48px rgba(255,0,40,0.9)",
              transform: "skewX(-10deg)",
            }}
          >
            {mark}
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
