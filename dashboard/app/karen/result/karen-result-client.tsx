"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import { KarenResultScreen } from "@/components/karen/karen-result-screen";
import type { TraitScores } from "@/lib/karen/game-engine";
import { readRespect } from "@/lib/karen/state";
import {
  hasLocalKarenUnlock,
  urlSignalsKarenUnlock,
} from "@/lib/karen/unlock";
import { readStoredResult } from "@/lib/karen/share-loop";

const Karen3D = dynamic(() => import("@/components/Karen3D"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});

const FACE_KEY = "karen.roast.face";

/**
 * Post-roast damage report — blurred until unlock.
 * Scores load from session/local storage (set when the quiz completes).
 */
export function KarenResultClient() {
  const router = useRouter();
  const [scores, setScores] = useState<TraitScores | null>(null);
  const [faceUrl, setFaceUrl] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [respectScore, setRespectScore] = useState(0);
  const [roastQuote, setRoastQuote] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStoredResult();
    if (!stored?.scores) {
      router.replace("/karen");
      return;
    }
    setScores(stored.scores);
    setRoastQuote(stored.verdict || stored.title || null);
    setRespectScore(readRespect());
    try {
      setFaceUrl(sessionStorage.getItem(FACE_KEY));
    } catch {
      setFaceUrl(null);
    }
    const params = new URLSearchParams(window.location.search);
    setUnlocked(hasLocalKarenUnlock() || urlSignalsKarenUnlock(params));
  }, [router]);

  if (!scores) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black text-sm text-zinc-500">
        Loading your damage…
      </div>
    );
  }

  return (
    <div className="relative karen-vh w-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0 z-0">
        <Karen3D mood="ANGRY" isSpeaking={false} className="absolute inset-0" />
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(255,45,85,0.22),transparent_55%)]"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black via-black/70 to-transparent" />
      </div>
      <KarenResultScreen
        scores={scores}
        avatarDataUrl={faceUrl}
        initialUnlocked={unlocked}
        respectScore={respectScore}
        roastQuote={roastQuote}
        onReplay={() => {
          try {
            sessionStorage.removeItem(FACE_KEY);
          } catch {
            /* ignore */
          }
          router.push("/karen?replay=1");
        }}
      />
    </div>
  );
}
