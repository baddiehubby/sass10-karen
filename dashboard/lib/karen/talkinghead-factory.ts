"use client";

/**
 * Production TalkingHead factory for Karen SaaS.
 * Loads the vendored `@met4citizen/talkinghead` (Desktop/GLB/TalkingHead-main).
 */

import type { TalkingHead, TalkingHeadOptions } from "@met4citizen/talkinghead";
import { mapChatMoodToTalkingHead } from "@/lib/karen/expression-bridge";

export const KAREN_GLB_URL = "/models/karen.glb";
export const TALKINGHEAD_WORKLET_URL = "/talkinghead/playback-worklet.js";

export type CreateKarenTalkingHeadOptions = {
  container: HTMLElement;
  mood?: string | null;
  /** Override camera framing. Default: upper-body for chat stage. */
  cameraView?: "full" | "mid" | "upper" | "head";
  onProgress?: (pct: number) => void;
};

/**
 * Create + show Karen's avatar with SaaS-tuned defaults
 * (muted Google TTS — we drive audio via speakWithKaren → speakAudio).
 */
export async function createKarenTalkingHead(
  opts: CreateKarenTalkingHeadOptions,
): Promise<TalkingHead> {
  const { TalkingHead: TalkingHeadCtor } = await import("@met4citizen/talkinghead");

  const headOpts: TalkingHeadOptions = {
    ttsEndpoint: "",
    ttsApikey: null,
    lipsyncModules: ["en"],
    lipsyncLang: "en",
    cameraView: opts.cameraView ?? "upper",
    cameraRotateEnable: true,
    cameraPanEnable: false,
    cameraZoomEnable: false,
    modelPixelRatio: Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      2,
    ),
    lightAmbientIntensity: 2.4,
    lightDirectIntensity: 30,
  };

  const head = new TalkingHeadCtor(opts.container, headOpts);

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

  head.setView(opts.cameraView ?? "upper");
  return head;
}
