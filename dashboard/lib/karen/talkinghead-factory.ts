"use client";

/**
 * Production TalkingHead factory for Karen SaaS.
 * Loads the vendored `@met4citizen/talkinghead` (Desktop/GLB/TalkingHead-main).
 *
 * Mood → blendshape map (applied via expression-bridge after load):
 *   [ANGRY]     → setMood("angry") + browDownLeft/Right = 1.0
 *   [SARCASTIC] → setMood("disgust") + mouthSmileLeft = 0.8 smirk
 *   [PROUD]     → setMood("happy")
 *   [SWEET]     → setMood("happy")
 *
 * Perf note: TalkingHead sets
 *   renderer.setPixelRatio(opt.modelPixelRatio * window.devicePixelRatio)
 * so we pass a *pre-divided* modelPixelRatio and re-clamp after construct.
 */

import type { TalkingHead, TalkingHeadOptions } from "@met4citizen/talkinghead";
import {
  applyExpressionToTalkingHead,
  mapChatMoodToTalkingHead,
} from "@/lib/karen/expression-bridge";

export const KAREN_GLB_URL = "/models/karen.glb";
export const TALKINGHEAD_WORKLET_URL = "/talkinghead/playback-worklet.js";

/** Cap backing-store resolution — sharp on Retina, safe on mobile. */
export const KAREN_MAX_PIXEL_RATIO = 1.5;

/** Face + upper-torso framing for the full-bleed chat stage. */
export const KAREN_CAMERA_VIEW = "upper" as const;
export const KAREN_CAMERA_OPTS = {
  /** Negative = closer (TalkingHead adds base distance per view). */
  cameraDistance: -1.1,
  cameraY: -0.12,
  /** Negative cameraX pans look-at right → centers a right-biased RPM rig. */
  cameraX: -0.35,
} as const;

export type CreateKarenTalkingHeadOptions = {
  container: HTMLElement;
  mood?: string | null;
  /** Override camera framing. Default: upper-body close-up for chat stage. */
  cameraView?: "full" | "mid" | "upper" | "head";
  onProgress?: (pct: number) => void;
};

type HeadWithRenderer = TalkingHead & {
  renderer?: {
    setPixelRatio: (n: number) => void;
    setSize: (w: number, h: number, updateStyle?: boolean) => void;
    getPixelRatio: () => number;
    shadowMap: { enabled: boolean; autoUpdate?: boolean };
    domElement?: HTMLCanvasElement;
  };
  camera?: { aspect: number; updateProjectionMatrix: () => void };
  controls?: { update: () => void };
  nodeAvatar?: HTMLElement;
  onResize?: () => void;
  lightDirect?: { castShadow?: boolean };
  lightSpot?: { castShadow?: boolean };
  lightAmbient?: { castShadow?: boolean };
};

/** Effective DPR after mobile-safe clamp. */
export function karenClampedPixelRatio(
  dpr: number = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
): number {
  return Math.min(Math.max(dpr, 1), KAREN_MAX_PIXEL_RATIO);
}

/**
 * TalkingHead does `setPixelRatio(modelPixelRatio * devicePixelRatio)`.
 * Pass the factor that makes the product equal our clamped ratio.
 */
export function karenModelPixelRatioOption(
  dpr: number = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
): number {
  const safeDpr = Math.max(dpr, 0.01);
  return karenClampedPixelRatio(safeDpr) / safeDpr;
}

/**
 * Clamp pixel ratio, keep shadows off, sync canvas to container size.
 * Safe to call after construct and on every resize.
 */
export function optimizeKarenRenderer(head: TalkingHead | null | undefined): void {
  const h = head as HeadWithRenderer | null | undefined;
  const renderer = h?.renderer;
  if (!renderer || typeof window === "undefined") return;

  const ratio = karenClampedPixelRatio(window.devicePixelRatio || 1);
  renderer.setPixelRatio(ratio);

  // Studio / TikTok look — no dynamic shadow maps.
  renderer.shadowMap.enabled = false;
  if ("autoUpdate" in renderer.shadowMap) {
    renderer.shadowMap.autoUpdate = false;
  }
  if (h.lightDirect) h.lightDirect.castShadow = false;
  if (h.lightSpot) h.lightSpot.castShadow = false;

  const node = h.nodeAvatar;
  if (node && node.clientWidth > 0 && node.clientHeight > 0) {
    if (typeof h.onResize === "function") {
      h.onResize();
    } else {
      if (h.camera) {
        h.camera.aspect = node.clientWidth / node.clientHeight;
        h.camera.updateProjectionMatrix();
      }
      renderer.setSize(node.clientWidth, node.clientHeight, false);
      h.controls?.update?.();
    }
  }
}

/**
 * Window + orientation resize → TalkingHead.onResize + re-clamp DPR.
 * Returns an unsubscribe fn for React cleanup.
 */
export function attachKarenRendererResize(
  head: TalkingHead | null | undefined,
): () => void {
  if (!head || typeof window === "undefined") return () => undefined;

  let raf = 0;
  const onWindowResize = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      optimizeKarenRenderer(head);
    });
  };

  window.addEventListener("resize", onWindowResize, { passive: true });
  window.addEventListener("orientationchange", onWindowResize, { passive: true });
  // One sync pass in case layout settled after mount.
  onWindowResize();

  return () => {
    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("orientationchange", onWindowResize);
    if (raf) window.cancelAnimationFrame(raf);
  };
}

/**
 * Create + show Karen's avatar with SaaS-tuned defaults
 * (muted Google TTS — we drive audio via speakWithKaren → speakAudio).
 */
export async function createKarenTalkingHead(
  opts: CreateKarenTalkingHeadOptions,
): Promise<TalkingHead> {
  const { TalkingHead: TalkingHeadCtor } = await import("@met4citizen/talkinghead");

  const view = opts.cameraView ?? KAREN_CAMERA_VIEW;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  const headOpts: TalkingHeadOptions = {
    ttsEndpoint: "",
    ttsApikey: null,
    // lipsync-*.mjs dynamic imports break under Next webpack; we inject LipsyncEn below.
    lipsyncModules: [],
    lipsyncLang: "en",
    cameraView: view,
    cameraDistance: KAREN_CAMERA_OPTS.cameraDistance,
    cameraRotateEnable: true,
    cameraPanEnable: false,
    cameraZoomEnable: false,
    // Pre-divided so TalkingHead's (opt * devicePixelRatio) lands at ≤ 1.5.
    modelPixelRatio: karenModelPixelRatioOption(dpr),
    lightAmbientColor: 0xffffff,
    lightAmbientIntensity: 2.2,
    lightDirectColor: 0xaaaacc,
    lightDirectIntensity: 32,
    lightSpotIntensity: 0,
    // Keep eyes on the user — lookAt() from pointer tracking tops this up.
    avatarIdleEyeContact: 0.55,
    avatarSpeakingEyeContact: 0.85,
    avatarListeningEyeContact: 0.7,
  };

  // Prefer TextureLoader over ImageBitmapLoader — bitmap path can silently
  // drop maps under some Chromium embeds (materials end up white).
  const prevCreateImageBitmap = globalThis.createImageBitmap;
  const forceTextureLoader = () => {
    try {
      // @ts-expect-error intentional — GLTFLoader checks typeof createImageBitmap
      delete globalThis.createImageBitmap;
    } catch {
      /* ignore */
    }
  };
  const restoreImageBitmap = () => {
    if (prevCreateImageBitmap) {
      globalThis.createImageBitmap = prevCreateImageBitmap;
    }
  };

  forceTextureLoader();
  try {
    const head = new TalkingHeadCtor(opts.container, headOpts);

    // Webpack cannot resolve TalkingHead's dynamic `import('./lipsync-en.mjs')`.
    // Inject the English processor statically so speakAudio can map words → visemes.
    try {
      const { LipsyncEn } = await import(
        /* webpackChunkName: "karen-lipsync-en" */
        "@met4citizen/talkinghead/modules/lipsync-en.mjs"
      );
      const lipHost = head as TalkingHead & { lipsync?: Record<string, unknown> };
      lipHost.lipsync = { ...(lipHost.lipsync || {}), en: new LipsyncEn() };
    } catch (err) {
      console.warn("[talkinghead-factory] LipsyncEn inject failed", err);
    }

    // Clamp DPR immediately (constructor already multiplied once).
    optimizeKarenRenderer(head);

    forceTextureLoader();
    await head.showAvatar(
      {
        url: KAREN_GLB_URL,
        body: "F",
        avatarMood: mapChatMoodToTalkingHead(opts.mood),
        lipsyncLang: "en",
        avatarMute: true,
      },
      (ev) => {
        if (!opts.onProgress || !ev.lengthComputable) return;
        opts.onProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
      },
    );

    // showAvatar / setView can touch sizing — re-clamp after load.
    optimizeKarenRenderer(head);

    head.setView(view, { ...KAREN_CAMERA_OPTS });

    // Seed mood blendshapes (angry brows / sarcastic smirk, etc.).
    applyExpressionToTalkingHead(head, opts.mood ?? "SARCASTIC", { isSpeaking: false });
    try {
      head.setMood(mapChatMoodToTalkingHead(opts.mood));
    } catch {
      /* mood morph may be missing on some rigs */
    }

    return head;
  } finally {
    restoreImageBitmap();
  }
}

/**
 * Soft mouse / pointer gaze so Karen looks at the user.
 * Call from a `pointermove` listener; `t` is look-at blend duration in ms.
 */
export function trackPointerGaze(
  head: TalkingHead | null | undefined,
  clientX: number,
  clientY: number,
  t = 900,
): void {
  if (!head || typeof head.lookAt !== "function") return;
  try {
    head.lookAt(clientX, clientY, t);
  } catch (err) {
    console.warn("[talkinghead-factory] lookAt failed", err);
  }
}
