"use client";

/**
 * Viewport fight HUD — Patience (top-right, red) + Dignity (top-left, blue),
 * full-screen impact flash, and floating damage numbers.
 * Mounted from `app/karen/page.tsx` so it sits above the 3D canvas.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { FightMeters } from "@/components/karen/fight-meters";
import {
  subscribeFightHit,
  subscribeFightHud,
  type FightHitEvent,
  type FightHudSnapshot,
} from "@/lib/karen/fight-hud-bus";
import { throwKarenHead, type HitImpactHost } from "@/lib/karen/hit-impact";
import { getRegisteredKarenTalkingHead } from "@/lib/karen/voice";

const FLOATER_MS = 1200;

type Floater = FightHitEvent & { born: number };

export function FightHud() {
  const [hud, setHud] = useState<FightHudSnapshot>({
    visible: false,
    dignity: 100,
    patience: 100,
  });
  const [flashId, setFlashId] = useState(0);
  const [floaters, setFloaters] = useState<Floater[]>([]);

  useEffect(() => subscribeFightHud(setHud), []);

  useEffect(() => {
    return subscribeFightHit((hit) => {
      if (hit.target === "dignity") setFlashId((n) => n + 1);
      const floater: Floater = { ...hit, born: Date.now() };
      setFloaters((prev) => [...prev.slice(-7), floater]);
      window.setTimeout(() => {
        setFloaters((prev) => prev.filter((f) => f.id !== hit.id));
      }, FLOATER_MS);
      try {
        throwKarenHead(
          getRegisteredKarenTalkingHead() as HitImpactHost | null,
          hit.pose,
        );
      } catch (err) {
        console.warn("[fight-hud] armature throw failed", err);
      }
    });
  }, []);

  if (!hud.visible && floaters.length === 0 && flashId === 0) return null;

  return (
    <>
      {hud.visible ? (
        <div
          className="pointer-events-none fixed inset-x-3 z-40"
          style={{
            top: "max(0.7rem, calc(env(safe-area-inset-top) + 0.45rem))",
          }}
          data-karen-fight-hud=""
        >
          <FightMeters dignity={hud.dignity} patience={hud.patience} />
        </div>
      ) : null}

      {/* Rapid red punch flash — Dignity hit / brutal WAV (0.4 @ 100ms). */}
      <AnimatePresence>
        {flashId > 0 ? (
          <motion.div
            key={`hit-flash-${flashId}`}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1, ease: "linear" }}
            className="pointer-events-none fixed inset-0 z-[36] bg-[#ff0000]"
            aria-hidden
            data-karen-hit-flash=""
          />
        ) : null}
      </AnimatePresence>

      {/* Floating damage — e.g. "-25 DIGNITY" floats up and fades */}
      <div className="pointer-events-none fixed inset-0 z-[37] overflow-hidden" aria-live="off">
        <AnimatePresence>
          {floaters.map((hit) => {
            const dignity = hit.target === "dignity";
            const jitter = ((hit.id * 37) % 70) - 35;
            return (
              <motion.p
                key={hit.id}
                initial={{ opacity: 1, y: 18, scale: 1.45, x: jitter, rotate: dignity ? -6 : 4 }}
                animate={{ opacity: 0, y: -110, scale: 1, x: jitter, rotate: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="absolute font-black uppercase tracking-[0.14em]"
                style={{
                  left: dignity ? "16%" : "auto",
                  right: dignity ? "auto" : "14%",
                  top: "36%",
                  color: dignity ? "#ff2d55" : "#60a5fa",
                  fontSize: "clamp(1.5rem, 4.6vw, 2.35rem)",
                  textShadow:
                    "0 0 22px currentColor, 0 3px 12px #000, 0 0 2px #000, 2px 2px 0 #000",
                }}
                data-karen-damage-number=""
              >
                -{hit.amount} {dignity ? "DIGNITY" : "PATIENCE"}
              </motion.p>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}
