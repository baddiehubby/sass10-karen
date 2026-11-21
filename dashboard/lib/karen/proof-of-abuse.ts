/**
 * Share Your Damage — viral roast poster (html-to-image + Web Share / download).
 */

import { toPng } from "html-to-image";

import { KAREN_SHARE_ORIGIN, captureKarenAvatarDataUrl } from "@/lib/karen/share-loop";

export const PROOF_OF_ABUSE_SIZE = { width: 320, height: 480 } as const;

/** Watermark printed on every exported PNG. */
export const PROOF_OF_ABUSE_WATERMARK = "Get roasted at SASS10.com";

/** Stable DOM id for the hidden cyberpunk poster (`#share-card`). */
export const SHARE_CARD_DOM_ID = "share-card";

export type ProofOfAbuseCardData = {
  /** Big title — e.g. "THE PROFESSIONAL OVERTHINKER" */
  title: string;
  /** Last roast quote under the title. */
  line?: string;
  /** Final Respect Score (can be negative, e.g. -50). */
  respectScore?: number;
  /** Optional extra metric rows (check-in / trait bars). */
  metrics?: Array<{ label: string; value: number | string }>;
  /** Pre-captured face; falls back to live canvas snapshot. */
  faceUrl?: string | null;
  /** Source tag for filename / analytics. */
  kind?: "roast" | "checkin";
};

/** Check-in titles for the share card. */
export function checkInAbuseTitle(didIt: boolean, respect: number): string {
  if (didIt) {
    if (respect >= 70) return "ACCIDENTALLY COMPETENT";
    if (respect >= 40) return "BARELY FUNCTIONING ADULT";
    return "ONE GOOD DAY WONDER";
  }
  if (respect <= 0) return "PROFESSIONAL DISAPPOINTMENT";
  if (respect <= 25) return "THE PROFESSIONAL COWARD";
  return "EXCUSE ARCHITECT";
}

export function checkInAbuseLine(didIt: boolean, goalLabel: string): string {
  const goal = goalLabel.trim() || "the one thing that mattered";
  return didIt
    ? `Survived evening interrogation about “${goal}”. Don't get cocky.`
    : `Failed “${goal}”. Karen remembers. Karen always remembers.`;
}

export async function captureProofOfAbusePng(
  node: HTMLElement,
): Promise<string> {
  return toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    width: PROOF_OF_ABUSE_SIZE.width,
    height: PROOF_OF_ABUSE_SIZE.height,
    // Solid fill so transparent WebGL pixels don't ghost.
    backgroundColor: "#0a0406",
  });
}

/** Mobile / coarse-pointer → native share sheet; desktop → PNG download. */
export function prefersNativeShareSheet(): boolean {
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
 * Share PNG via Web Share API on mobile, or download on desktop.
 * Returns a short status string for UI.
 */
export async function shareProofOfAbusePng(opts: {
  dataUrl: string;
  title: string;
  text?: string;
  url?: string;
  fileName?: string;
}): Promise<string> {
  const fileName = opts.fileName || "sass10-share-this-roast.png";
  const blob = await (await fetch(opts.dataUrl)).blob();
  const file = new File([blob], fileName, { type: "image/png" });
  const shareUrl = opts.url || KAREN_SHARE_ORIGIN;
  const text =
    opts.text ||
    `${opts.title}\n${PROOF_OF_ABUSE_WATERMARK}\n${shareUrl}`;

  if (prefersNativeShareSheet()) {
    const payload: ShareData = {
      title: opts.title,
      text,
      url: shareUrl,
    };
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ ...payload, files: [file] });
      } else {
        await navigator.share(payload);
      }
      return "Shared.";
    } catch (err) {
      // User cancel — don't fall through to download as a surprise.
      if (err instanceof DOMException && err.name === "AbortError") {
        return "Share cancelled.";
      }
      console.warn("[share-card] share failed — downloading", err);
    }
  }

  const a = document.createElement("a");
  a.href = opts.dataUrl;
  a.download = fileName;
  a.click();
  return "Downloaded your roast card.";
}

export function resolveAbuseFaceUrl(explicit?: string | null): string | null {
  if (explicit) return explicit;
  return captureKarenAvatarDataUrl();
}
