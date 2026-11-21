/**
 * Share Your Defeat — 320×568 TikTok poster capture + native share / download.
 */

import { toPng } from "html-to-image";

import { captureKarenAvatarDataUrl } from "@/lib/karen/share-loop";

export const SHARE_DEFEAT_SIZE = { width: 320, height: 568 } as const;

/** Burned into the bottom of every exported PNG. */
export const SHARE_DEFEAT_WATERMARK = "SASS10.app";

export const SHARE_DEFEAT_HEADLINE = "I TRIED TO FIGHT KAREN...";
export const SHARE_DEFEAT_TAGLINE = "She muted me. 10/10.";

export const SHARE_DEFEAT_DOM_ID = "sass10-share-defeat-card";

export type ShareDefeatScores = {
  karen: number;
  me: number;
};

export function formatDefeatScoreLine(scores: ShareDefeatScores): string {
  const karen = Math.max(0, Math.round(scores.karen));
  const me = Math.max(0, Math.round(scores.me));
  return `KAREN: ${karen} | ME: ${me}`;
}

/** Default smash scoreboard when the fight ends in a mute / dignity wipe. */
export function defeatScoresFromRespect(respect?: number | null): ShareDefeatScores {
  if (typeof respect !== "number" || !Number.isFinite(respect)) {
    return { karen: 5, me: 0 };
  }
  // Lower respect → higher Karen score (capped 9–1 style fighting numbers).
  const karen = Math.max(3, Math.min(9, Math.round(5 + (40 - respect) / 20)));
  return { karen, me: 0 };
}

export async function captureShareDefeatPng(node: HTMLElement): Promise<string> {
  return toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    width: SHARE_DEFEAT_SIZE.width,
    height: SHARE_DEFEAT_SIZE.height,
    backgroundColor: "#050208",
  });
}

function prefersNativeShare(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const narrow = window.matchMedia?.("(max-width: 900px)")?.matches;
  const ua = typeof navigator.userAgent === "string" ? navigator.userAgent : "";
  return Boolean(coarse || narrow || /Android|iPhone|iPad|Mobile/i.test(ua));
}

/**
 * iOS / mobile → `navigator.share` (files when supported).
 * Desktop / fallback → PNG download.
 */
export async function shareDefeatPng(opts: {
  dataUrl: string;
  fileName?: string;
  title?: string;
  text?: string;
}): Promise<string> {
  const fileName = opts.fileName || "sass10-i-tried-to-fight-karen.png";
  const title = opts.title || SHARE_DEFEAT_HEADLINE;
  const text =
    opts.text ||
    `${SHARE_DEFEAT_HEADLINE}\n${SHARE_DEFEAT_TAGLINE}\n${SHARE_DEFEAT_WATERMARK}`;

  const blob = await (await fetch(opts.dataUrl)).blob();
  const file = new File([blob], fileName, { type: "image/png" });

  if (prefersNativeShare()) {
    const payload: ShareData = { title, text };
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ ...payload, files: [file] });
      } else {
        await navigator.share(payload);
      }
      return "Opened share sheet.";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "Share cancelled.";
      }
      console.warn("[share-defeat] navigator.share failed — downloading", err);
    }
  }

  const a = document.createElement("a");
  a.href = opts.dataUrl;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return "Downloaded your defeat card.";
}

export function resolveDefeatFaceUrl(explicit?: string | null): string | null {
  if (explicit) return explicit;
  return captureKarenAvatarDataUrl();
}
