"use client";

import { useEffect, useRef, useState } from "react";
import type { TalkingHead } from "@met4citizen/talkinghead";
import {
  applyExpressionToTalkingHead,
  mapChatMoodToTalkingHead,
  normalizeMood,
  type KarenExpressionMood,
} from "@/lib/karen/expression-bridge";
import {
  registerKarenTalkingHead,
  speakWithKaren,
  stopKarenSpeech,
} from "@/lib/karen/voice";
import { createKarenTalkingHead } from "@/lib/karen/talkinghead-factory";
import {
  subscribeKarenAvatar,
  subscribeKarenSpeaking,
} from "@/lib/karen/talkinghead-bus";

export type Karen3DMood = string | null | undefined;

type Karen3DProps = {
  mood?: Karen3DMood;
  isSpeaking?: boolean;
  className?: string;
};

/** @deprecated use mapChatMoodToTalkingHead from expression-bridge */
export { mapChatMoodToTalkingHead };

function applyShoutCamera(head: TalkingHead, angry: boolean) {
  try {
    if (angry) {
      head.setView("head", {
        cameraDistance: -0.55,
        cameraY: 0.08,
      });
    } else {
      head.setView("upper", {
        cameraDistance: 0,
        cameraY: 0,
      });
    }
  } catch (err) {
    console.warn("[Karen3D] setView failed", err);
  }
}

/**
 * Karen 3D avatar — vendored TalkingHead + speakAudio lip-sync + Sass-10 shake.
 */
export function Karen3D({ mood, isSpeaking = false, className = "" }: Karen3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<TalkingHead | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioSpeaking, setAudioSpeaking] = useState(false);

  const speaking = isSpeaking || audioSpeaking;

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof window === "undefined") return;

    let cancelled = false;
    let head: TalkingHead | null = null;

    const onVisibility = () => {
      if (!head) return;
      if (document.visibilityState === "visible") head.start();
      else head.stop();
    };

    (async () => {
      try {
        head = await createKarenTalkingHead({
          container: node,
          mood,
          cameraView: "upper",
          onProgress: setProgress,
        });
        if (cancelled) {
          head.stop();
          return;
        }
        headRef.current = head;
        registerKarenTalkingHead(head);
        applyExpressionToTalkingHead(head, normalizeMood(mood), { isSpeaking: false });
        document.addEventListener("visibilitychange", onVisibility);
        setStatus("ready");
      } catch (err) {
        console.error("[Karen3D] TalkingHead init failed", err);
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(err instanceof Error ? err.message : "Failed to load avatar");
        }
      }
    })();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      stopKarenSpeech();
      registerKarenTalkingHead(null);
      try {
        head?.stop();
      } catch {
        /* ignore teardown races */
      }
      headRef.current = null;
      if (node) node.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return subscribeKarenAvatar((evt) => {
      const head = headRef.current;
      if (!head || status !== "ready") return;
      const next = normalizeMood(evt.mood) as KarenExpressionMood;
      applyShoutCamera(head, next === "ANGRY" || next === "FURIOUS");
      applyExpressionToTalkingHead(head, next, {
        isSpeaking: Boolean(evt.isSpeaking),
      });
      if (evt.lipSync && evt.text) {
        // text → AudioBuffer → speakAudio (+ sentence chunking for early lip motion)
        void speakWithKaren(evt.text, next, head);
      }
    });
  }, [status]);

  useEffect(() => {
    return subscribeKarenSpeaking((s) => setAudioSpeaking(s));
  }, []);

  useEffect(() => {
    const head = headRef.current;
    if (!head || status !== "ready") return;
    const next = normalizeMood(mood);
    applyShoutCamera(head, next === "ANGRY" || next === "FURIOUS");
    applyExpressionToTalkingHead(head, next, { isSpeaking: speaking });
  }, [mood, speaking, status]);

  return (
    <div className={`relative h-full min-h-0 w-full ${className}`}>
      {/* Full-bleed TalkingHead canvas (parent is w-screen h-screen) */}
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full overflow-hidden [&_canvas]:h-full [&_canvas]:w-full"
        aria-label="Karen 3D avatar"
      />

      {status === "loading" && (
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/50"
          aria-busy="true"
        >
          <div className="h-36 w-36 animate-pulse rounded-full bg-rose-500/20 ring-2 ring-rose-400/30" />
          <p className="text-[10px] font-semibold tracking-[0.28em] text-rose-200/80">
            LOADING {progress > 0 ? `${progress}%` : "…"}
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950/70 px-4 text-center">
          <p className="text-sm font-semibold text-rose-300">Avatar failed to load</p>
          <p className="max-w-xs text-xs text-zinc-400">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

export default Karen3D;
