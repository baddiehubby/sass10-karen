"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useAnimationControls } from "framer-motion";

import { Karen2DFallback } from "@/components/karen/karen-2d-fallback";
import { setKaren2DFallback } from "@/lib/karen/fallback-2d";
import { subscribeFightHit } from "@/lib/karen/fight-hud-bus";
import { snapKarenHeadRecoil } from "@/lib/karen/talkinghead-factory";
import {
  subscribeKarenHangUp,
  subscribeKarenRecoil,
  subscribeKarenStageBlur,
} from "@/lib/karen/talkinghead-bus";
import { getRegisteredKarenTalkingHead } from "@/lib/karen/voice";

/** Camera-hit keyframes — violent punch, not a light show. */
const VIOLENT_SHAKE = {
  x: [0, -25, 25, -20, 20, -10, 10, 0],
  y: [0, 10, -10, 10, -10, 0],
  transition: { duration: 0.3, type: "tween" as const },
};

/**
 * Full-viewport avatar layer — must stay behind UI (z-0).
 * Client-only: WebGL + TalkingHead cannot SSR.
 * On init failure / WebGL context lost → static 2D portrait + HTMLAudio path.
 */

const Karen3D = dynamic(() => import("@/components/Karen3D"), {
  ssr: false,
  loading: () => (
    <div className="pointer-events-none fixed inset-0 w-screen h-screen z-0 flex items-center justify-center bg-black">
      <div className="h-40 w-40 animate-pulse rounded-full bg-rose-500/20 ring-2 ring-rose-400/30" />
    </div>
  ),
});

export function KarenAvatarBackdrop() {
  const [hungUp, setHungUp] = useState(false);
  const [stageBlurred, setStageBlurred] = useState(false);
  const [use2DFallback, setUse2DFallback] = useState(false);
  const stage = useAnimationControls();

  useEffect(() => subscribeKarenHangUp(setHungUp), []);
  useEffect(() => subscribeKarenStageBlur(setStageBlurred), []);

  useEffect(() => {
    if (hungUp) {
      void stage.start({
        x: "-110%",
        y: 0,
        opacity: 0.15,
        rotate: -8,
        scale: 0.92,
        transition: { type: "spring", stiffness: 160, damping: 16, mass: 1.1 },
      });
      return;
    }
    void stage.start({
      x: 0,
      y: 0,
      opacity: 1,
      rotate: 0,
      scale: 1,
      transition: { type: "spring", stiffness: 220, damping: 26 },
    });
  }, [hungUp, stage]);

  useEffect(
    () =>
      subscribeKarenRecoil(() => {
        if (hungUp) return;
        // 3D armature snap (−0.15 back → forward + Z tilt).
        snapKarenHeadRecoil(getRegisteredKarenTalkingHead());
        void stage.start({
          ...VIOLENT_SHAKE,
          rotate: [0, 8, -3, 0],
          scale: [1, 0.92, 1.04, 1],
          opacity: 1,
        });
      }),
    [hungUp, stage],
  );

  useEffect(
    () =>
      subscribeFightHit((hit) => {
        if (hungUp || hit.target !== "dignity") return;
        snapKarenHeadRecoil(getRegisteredKarenTalkingHead());
        void stage.start({
          ...VIOLENT_SHAKE,
          rotate: [0, -4, 3, -2, 0],
          scale: [1, 1.04, 0.97, 1.02, 1],
          opacity: 1,
        });
      }),
    [hungUp, stage],
  );

  const enable2DFallback = useCallback((reason?: string) => {
    console.warn("[KarenAvatar] WebGL/TalkingHead failed — using 2D fallback", reason ?? "");
    setKaren2DFallback(true);
    setUse2DFallback(true);
  }, []);

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0 h-screen w-screen"
      aria-hidden
      data-karen-canvas-wrap=""
      data-karen-2d={use2DFallback ? "1" : "0"}
      data-karen-stage-blur={stageBlurred ? "1" : "0"}
      initial={false}
      animate={stage}
      style={{
        filter: stageBlurred
          ? "blur(18px) saturate(0.4) brightness(0.42)"
          : "none",
        transition: "filter 0.45s ease",
      }}
    >
      {use2DFallback ? (
        <Karen2DFallback />
      ) : (
        <Karen3D mood="SARCASTIC" isSpeaking={false} onFatalError={enable2DFallback} />
      )}
    </motion.div>
  );
}
