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
  stopKarenSpeech,
  unlockKarenAudio,
} from "@/lib/karen/voice";
import { isColdShoulder } from "@/lib/karen/state";
import { probeWebGL } from "@/lib/karen/webgl-probe";
import {
  animateKarenInterrogationZoom,
  animateKarenSpeakPushIn,
  animateKarenWhipPan,
  applyKarenFacingCorrection,
  applyKarenMoodLighting,
  applyKarenPortraitCamera,
  attachKarenRendererResize,
  createKarenTalkingHead,
  exposeKarenDebugConsole,
  forceKarenRendererFullscreen,
  KAREN_CAMERA_VIEW,
  MODEL_YAW,
  pauseKarenRuntime,
  resumeKarenRuntime,
  setKarenCameraWide,
  setKarenFacingAway,
  trackPointerGaze,
} from "@/lib/karen/talkinghead-factory";
import {
  subscribeKarenAvatar,
  getKarenStageLayout,
  subscribeKarenCamera,
  subscribeKarenFacing,
  subscribeKarenSpeaking,
} from "@/lib/karen/talkinghead-bus";

export type Karen3DMood = string | null | undefined;

type Karen3DProps = {
  mood?: Karen3DMood;
  isSpeaking?: boolean;
  className?: string;
  /** WebGL / TalkingHead init failure → parent swaps to static 2D avatar. */
  onFatalError?: (reason: string) => void;
};

/** @deprecated use mapChatMoodToTalkingHead from expression-bridge */
export { mapChatMoodToTalkingHead };

/**
 * Karen 3D avatar — full-viewport canvas behind UI (z-0).
 * Mounted at page level (outside Framer Motion) so `fixed` stays viewport-true.
 * TalkingHead init is wrapped in try/catch; failures escalate via onFatalError.
 */
export function Karen3D({
  mood,
  isSpeaking = false,
  className = "",
  onFatalError,
}: Karen3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<TalkingHead | null>(null);
  const onFatalErrorRef = useRef(onFatalError);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioSpeaking, setAudioSpeaking] = useState(false);

  const speaking = isSpeaking || audioSpeaking;

  useEffect(() => {
    onFatalErrorRef.current = onFatalError;
  }, [onFatalError]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof window === "undefined") return;

    let cancelled = false;
    let head: TalkingHead | null = null;
    let detachResize: (() => void) | null = null;
    let canvasEl: HTMLCanvasElement | null = null;

    const onVisibility = () => {
      if (!head) return;
      if (document.visibilityState === "visible") {
        resumeKarenRuntime(head);
        void unlockKarenAudio(head);
      } else {
        // Tab hidden / app backgrounded — stop render loop + suspend AudioContext.
        stopKarenSpeech();
        pauseKarenRuntime(head);
      }
    };

    const onPageHide = () => {
      if (!head) return;
      stopKarenSpeech();
      pauseKarenRuntime(head);
    };

    const onContextLost = (ev: Event) => {
      // Prevent default restore attempts that thrash a dying GPU context on iOS.
      try {
        ev.preventDefault();
      } catch {
        /* ignore */
      }
      console.error(
        "[Karen3D] WebGL context LOST — switching to 2D fallback so the tab stays alive.",
      );
      if (cancelled) return;
      // Tear down safely BEFORE React remounts 2D (avoids mid-frame GPU crash).
      try {
        stopKarenSpeech();
        pauseKarenRuntime(head);
        head?.stop?.();
      } catch {
        /* ignore */
      }
      setStatus("error");
      setErrorMsg("WebGL context lost");
      window.setTimeout(() => {
        if (!cancelled) onFatalErrorRef.current?.("WebGL context lost");
      }, 0);
    };

    (async () => {
      try {
        // Never silently degrade: if WebGL can't run, say exactly why (console + overlay).
        const probe = probeWebGL();
        if (!probe.ok) {
          console.error("[Karen3D] WebGL unavailable — cannot render the 3D avatar:", probe.reason);
          throw new Error(`WebGL unavailable: ${probe.reason}`);
        }
        console.info(
          `[Karen3D] WebGL${probe.version} OK — ${probe.renderer}`,
          probe.software
            ? "(SOFTWARE renderer: still real 3D, but CPU-rendered and slow — enable hardware acceleration)"
            : "",
        );

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
        applyKarenMoodLighting(head, mood);

        const host = head as TalkingHead & {
          armature?: { rotation?: { y: number } } | null;
          vrm?: { scene?: { rotation?: { y: number } } } | null;
        };
        // Face camera — rotate armature / vrm.scene (not TalkingHead.avatar config).
        if (host.armature?.rotation) host.armature.rotation.y = MODEL_YAW;
        if (host.vrm?.scene?.rotation) host.vrm.scene.rotation.y = MODEL_YAW;
        applyKarenFacingCorrection(head, MODEL_YAW);

        setKarenFacingAway(head, isColdShoulder());
        detachResize = attachKarenRendererResize(head);
        forceKarenRendererFullscreen(head);
        // Failsafe AFTER yaw + resize: look at bbox center.
        applyKarenPortraitCamera(head);
        exposeKarenDebugConsole(head);

        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pagehide", onPageHide);
        canvasEl = node.querySelector("canvas");
        canvasEl?.addEventListener("webglcontextlost", onContextLost, false);
        setStatus("ready");
      } catch (err) {
        console.error("[Karen3D] TalkingHead init failed", err);
        if (!cancelled) {
          const reason = err instanceof Error ? err.message : "Failed to load avatar";
          setStatus("error");
          setErrorMsg(reason);
          onFatalErrorRef.current?.(reason);
        }
      }
    })();

    return () => {
      cancelled = true;
      detachResize?.();
      detachResize = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      canvasEl?.removeEventListener("webglcontextlost", onContextLost);
      stopKarenSpeech();
      pauseKarenRuntime(head);
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
      applyKarenMoodLighting(head, next);
      applyExpressionToTalkingHead(head, next, { isSpeaking: false });
      if (evt.lipSync && evt.text) {
        animateKarenWhipPan(head);
        void import("@/lib/karen/voice").then(({ speakLocalRoast }) =>
          speakLocalRoast(evt.text!, {
            mood: next,
            head,
            trait: evt.trait,
            audioId: evt.audioId,
            questionId: evt.questionId,
            answerId: evt.answerId,
            dynamic: evt.dynamic,
          }),
        );
      }
    });
  }, [status]);

  useEffect(() => {
    // Avatar finished loading AFTER the stage changed (e.g. game began first) → catch up.
    if (status === "ready" && headRef.current) {
      (headRef.current as unknown as { setStageLayout?: (l: "intro" | "game") => void }).setStageLayout?.(
        getKarenStageLayout(),
      );
    }
    return subscribeKarenCamera((mode) => {
      const head = headRef.current;
      if (!head || status !== "ready") return;
      if (mode === "wide") setKarenCameraWide(head);
      else if (mode === "interrogation") animateKarenInterrogationZoom(head);
      else if (mode === "whip") animateKarenWhipPan(head);
      else if (mode === "stage-intro" || mode === "stage-game") {
        (head as unknown as { setStageLayout?: (l: "intro" | "game") => void }).setStageLayout?.(
          mode === "stage-game" ? "game" : "intro",
        );
      }
    });
  }, [status]);

  useEffect(() => {
    return subscribeKarenSpeaking((s) => {
      setAudioSpeaking(s);
      // Kokoro speak → aggressive camera push-in (1.5 → 1.2).
      animateKarenSpeakPushIn(headRef.current, s);
    });
  }, []);

  useEffect(() => {
    return subscribeKarenFacing((away) => {
      const head = headRef.current;
      if (!head || status !== "ready") return;
      setKarenFacingAway(head, away);
    });
  }, [status]);

  useEffect(() => {
    const head = headRef.current;
    if (!head || status !== "ready") return;
    const next = normalizeMood(mood);
    applyKarenMoodLighting(head, next);
    // NEVER re-apply face morphs while speakAudio owns the jaw — that resets lips mid-line.
    if (speaking) return;
    applyExpressionToTalkingHead(head, next, { isSpeaking: false });
  }, [mood, speaking, status]);

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
      if (isColdShoulder()) return;
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
      if (!isColdShoulder()) headRef.current?.lookAtCamera?.(1200);
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
      className={`pointer-events-none fixed inset-0 w-screen h-screen z-0 ${className}`.trim()}
      style={{
        pointerEvents: "none",
        background: "#000",
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
      data-karen-3d=""
      data-karen-3d-status={status}
    >
      <div
        ref={containerRef}
        className="pointer-events-none fixed inset-0 w-screen h-screen z-0 overflow-hidden [&_canvas]:!pointer-events-none [&_canvas]:![touch-action:none] [&_canvas]:!absolute [&_canvas]:!inset-0 [&_canvas]:!block [&_canvas]:!h-full [&_canvas]:!w-full"
        aria-label="Karen 3D avatar"
      />

      {status === "loading" && (
        <div
          className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3 bg-black/40"
          aria-busy="true"
        >
          <div className="h-36 w-36 animate-pulse rounded-full bg-rose-500/20 ring-2 ring-rose-400/30" />
          <p className="text-[10px] font-semibold tracking-[0.28em] text-rose-200/80">
            LOADING {progress > 0 ? `${progress}%` : "..."}
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center">
          <p className="text-sm font-semibold text-rose-300">Avatar failed to load</p>
          <p className="max-w-xs text-xs text-zinc-400">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

export default Karen3D;
