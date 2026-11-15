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
import {
  attachKarenRendererResize,
  createKarenTalkingHead,
  KAREN_CAMERA_OPTS,
  KAREN_CAMERA_VIEW,
  trackPointerGaze,
} from "@/lib/karen/talkinghead-factory";
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
      head.setView(KAREN_CAMERA_VIEW, { ...KAREN_CAMERA_OPTS });
    }
  } catch (err) {
    console.warn("[Karen3D] setView failed", err);
  }
}

/**
 * Karen 3D avatar — full-viewport TalkingHead canvas (z-0 layer).
 * Mounts strictly via useEffect so the canvas exists after client hydration.
 */
export function Karen3D({ mood, isSpeaking = false, className = "" }: Karen3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<TalkingHead | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioSpeaking, setAudioSpeaking] = useState(false);
  const [mounted, setMounted] = useState(false);

  const speaking = isSpeaking || audioSpeaking;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const node = containerRef.current;
    if (!node || typeof window === "undefined") return;

    let cancelled = false;
    let head: TalkingHead | null = null;
    let detachResize: (() => void) | null = null;

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
          cameraView: KAREN_CAMERA_VIEW,
          onProgress: setProgress,
        });
        if (cancelled) {
          head.stop();
          return;
        }
        headRef.current = head;
        registerKarenTalkingHead(head);
        applyExpressionToTalkingHead(head, normalizeMood(mood), { isSpeaking: false });
        detachResize = attachKarenRendererResize(head);
        if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
          (window as unknown as { __karenHead?: TalkingHead }).__karenHead = head;
        }
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
      detachResize?.();
      detachResize = null;
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
  }, [mounted]);

  useEffect(() => {
    return subscribeKarenAvatar((evt) => {
      const head = headRef.current;
      if (!head || status !== "ready") return;
      const next = normalizeMood(evt.mood) as KarenExpressionMood;
      applyShoutCamera(head, next === "ANGRY" || next === "FURIOUS");
      // Mood only — mouth is driven by ElevenLabs AudioBuffer via speakAudio.
      applyExpressionToTalkingHead(head, next, { isSpeaking: false });
      if (evt.lipSync && evt.text) {
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
    // Never fake jawOpen while speaking — TalkingHead owns lips from real audio.
    applyExpressionToTalkingHead(head, next, { isSpeaking: false });
  }, [mood, speaking, status]);

  // Soft gaze: Karen tracks the pointer so she looks at the user.
  useEffect(() => {
    if (status !== "ready") return;
    let raf = 0;
    let lastX = 0;
    let lastY = 0;
    let dirty = false;

    const flush = () => {
      raf = 0;
      if (!dirty) return;
      dirty = false;
      trackPointerGaze(headRef.current, lastX, lastY, 1100);
    };

    const onPointerMove = (e: PointerEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      dirty = true;
      if (!raf) raf = window.requestAnimationFrame(flush);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    try {
      headRef.current?.lookAtCamera?.(1200);
    } catch {
      /* optional */
    }

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [status]);

  return (
    <div
      className={`absolute inset-0 z-0 h-full min-h-[100vh] w-full ${className}`}
      style={{ minHeight: "100vh" }}
    >
      {/* Full-bleed TalkingHead canvas — absolute inset-0 fills the stage */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-0 h-full min-h-[100vh] w-full overflow-hidden [&_canvas]:absolute [&_canvas]:inset-0 [&_canvas]:h-full [&_canvas]:w-full [&_canvas]:!max-h-none [&_canvas]:!max-w-none"
        style={{ minHeight: "100vh" }}
        aria-label="Karen 3D avatar"
      />

      {status === "loading" && (
        <div
          className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3 bg-black/40"
          aria-busy="true"
        >
          <div className="h-36 w-36 animate-pulse rounded-full bg-rose-500/20 ring-2 ring-rose-400/30" />
          <p className="text-[10px] font-semibold tracking-[0.28em] text-rose-200/80">
            LOADING {progress > 0 ? `${progress}%` : "…"}
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-zinc-950/70 px-4 text-center">
          <p className="text-sm font-semibold text-rose-300">Avatar failed to load</p>
          <p className="max-w-xs text-xs text-zinc-400">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

export default Karen3D;
