"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import {
  subscribeKarenAvatar,
  subscribeKarenHangUp,
  subscribeKarenFuriousAlert,
} from "@/lib/karen/talkinghead-bus";

/**
 * Page-level tension FX:
 * - FURIOUS → red-alert room wash
 * - Mute Protocol hang-up → "KAREN HAS LEFT THE CHAT"
 */
export function KarenTensionFx() {
  const [furious, setFurious] = useState(false);
  const [hungUp, setHungUp] = useState(false);

  useEffect(() => {
    const unsubAlert = subscribeKarenFuriousAlert(setFurious);
    const unsubHang = subscribeKarenHangUp(setHungUp);
    const unsubAvatar = subscribeKarenAvatar((evt) => {
      const m = String(evt.mood || "").toUpperCase();
      setFurious(m === "FURIOUS" || m === "ANGRY");
    });
    return () => {
      unsubAlert();
      unsubHang();
      unsubAvatar();
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {furious && !hungUp ? (
          <motion.div
            key="red-alert"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none fixed inset-0 z-[12] bg-red-500/20 mix-blend-overlay animate-pulse"
            aria-hidden
            data-karen-red-alert=""
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {hungUp ? (
          <motion.div
            key="hang-up"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-[25] flex items-center justify-center bg-black/55 px-6"
            aria-live="assertive"
            data-karen-hang-up=""
          >
            <motion.p
              initial={{ opacity: 0, scale: 0.85, x: 40 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              className="max-w-xl text-center text-3xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-5xl md:text-6xl"
              style={{
                textShadow:
                  "0 0 40px rgba(255,45,85,0.55), 0 2px 24px rgba(0,0,0,0.95)",
              }}
            >
              KAREN HAS LEFT THE CHAT.
            </motion.p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
