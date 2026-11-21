"use client";

/**
 * Launch shell for TikTok traffic:
 * StartGate (AudioContext + mic) → Preloader (20 WAVs) → /karen.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { AudioPreloader } from "@/components/karen/audio-preloader";
import { StartGate } from "@/components/karen/start-gate";
import { getKarenAudioContext } from "@/lib/karen/voice";

type Phase = "gate" | "preload";

export function KarenLaunch() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("gate");
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  const onUnlocked = useCallback(async (ctx: AudioContext) => {
    try {
      const shared = getKarenAudioContext(ctx);
      if (shared.state === "suspended") await shared.resume();
    } catch {
      /* shared may already exist */
    }
    setAudioContext(ctx);
    setPhase("preload");
  }, []);

  const onPreloadReady = useCallback(() => {
    router.push("/karen");
  }, [router]);

  if (phase === "preload" && audioContext) {
    return (
      <AudioPreloader audioContext={audioContext} onReady={onPreloadReady} />
    );
  }

  return <StartGate onUnlocked={onUnlocked} />;
}
