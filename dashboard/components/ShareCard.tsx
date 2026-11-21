"use client";

/**
 * Share Your Defeat — hidden 320×568 cyberpunk poster for TikTok / native share.
 * Capture with html-to-image → navigator.share (iOS) or PNG download.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";

import {
  SHARE_DEFEAT_DOM_ID,
  SHARE_DEFEAT_HEADLINE,
  SHARE_DEFEAT_SIZE,
  SHARE_DEFEAT_TAGLINE,
  SHARE_DEFEAT_WATERMARK,
  captureShareDefeatPng,
  defeatScoresFromRespect,
  formatDefeatScoreLine,
  resolveDefeatFaceUrl,
  shareDefeatPng,
  type ShareDefeatScores,
} from "@/lib/karen/share-defeat";

const NEON = "#ff2d55";

export type ShareCardProps = {
  /** Pre-captured TalkingHead / WebGL canvas frame. */
  faceUrl?: string | null;
  /** Final scoreboard — defaults to Karen smash (5–0). */
  scores?: ShareDefeatScores;
  /** Derive scores from Respect when `scores` omitted. */
  respectScore?: number | null;
  headline?: string;
  tagline?: string;
  onShared?: (status: string) => void;
  className?: string;
  /** CTA label — default "Share on TikTok". */
  ctaLabel?: string;
};

/** Off-screen defeat poster — keep mounted while capturing. */
export function ShareDefeatPoster({
  cardRef,
  faceUrl,
  scoreLine,
  headline = SHARE_DEFEAT_HEADLINE,
  tagline = SHARE_DEFEAT_TAGLINE,
}: {
  cardRef: React.RefObject<HTMLDivElement>;
  faceUrl: string | null;
  scoreLine: string;
  headline?: string;
  tagline?: string;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -left-[9999px] top-0 z-[-1] overflow-hidden"
    >
      <div
        id={SHARE_DEFEAT_DOM_ID}
        ref={cardRef}
        style={{
          width: SHARE_DEFEAT_SIZE.width,
          height: SHARE_DEFEAT_SIZE.height,
          background:
            "linear-gradient(168deg, #2c0612 0%, #0a0408 42%, #020104 100%)",
          color: "#fff",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          position: "relative",
          overflow: "hidden",
          border: `2px solid rgba(255,45,85,0.7)`,
          boxSizing: "border-box",
        }}
      >
        {/* Cyber grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,45,85,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,45,85,0.07) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            opacity: 0.6,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 18%, rgba(255,45,85,0.55), transparent 52%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -40,
            bottom: 80,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: "rgba(255,20,80,0.18)",
            filter: "blur(40px)",
          }}
        />

        <div
          style={{
            position: "relative",
            padding: "22px 18px 16px",
            height: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 9,
              letterSpacing: "0.42em",
              textTransform: "uppercase",
              color: "#ff4d6d",
              fontWeight: 800,
            }}
          >
            SASS10 · GAME OVER
          </p>

          <h1
            style={{
              margin: "16px 0 0",
              fontSize: 26,
              lineHeight: 1.05,
              fontWeight: 900,
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "-0.03em",
              textShadow: `0 0 22px rgba(255,45,85,0.85)`,
              maxWidth: 280,
            }}
          >
            {headline}
          </h1>

          {/* Avatar frame — 3D canvas screenshot */}
          <div
            style={{
              marginTop: 22,
              width: 196,
              height: 196,
              borderRadius: 18,
              overflow: "hidden",
              border: `2px solid ${NEON}`,
              boxShadow: `0 0 42px rgba(255,45,85,0.55), inset 0 0 24px rgba(0,0,0,0.45)`,
              background: "#10060a",
              flexShrink: 0,
            }}
          >
            {faceUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={faceUrl}
                alt=""
                crossOrigin="anonymous"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center 18%",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background:
                    "radial-gradient(circle at 50% 36%, #6a1a38, #10060a 72%)",
                }}
              />
            )}
          </div>

          <p
            style={{
              margin: "22px 0 0",
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: "0.08em",
              fontVariantNumeric: "tabular-nums",
              textAlign: "center",
              color: "#fff",
              textShadow: `0 0 16px rgba(255,45,85,0.65)`,
            }}
          >
            {scoreLine}
          </p>

          <p
            style={{
              margin: "14px 0 0",
              fontSize: 15,
              fontWeight: 700,
              textAlign: "center",
              color: "#fecdd3",
              fontStyle: "italic",
            }}
          >
            {tagline}
          </p>

          {/* Watermark — burned into PNG */}
          <p
            style={{
              marginTop: "auto",
              paddingTop: 12,
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.78)",
              textShadow: `0 0 12px rgba(255,45,85,0.45)`,
            }}
          >
            {SHARE_DEFEAT_WATERMARK}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Hidden ShareCard + "Share on TikTok" CTA.
 * Captures PNG via html-to-image, then native share sheet or download.
 */
export function ShareCard({
  faceUrl: faceUrlProp,
  scores: scoresProp,
  respectScore,
  headline = SHARE_DEFEAT_HEADLINE,
  tagline = SHARE_DEFEAT_TAGLINE,
  onShared,
  className = "",
  ctaLabel = "Share on TikTok",
}: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [faceUrl, setFaceUrl] = useState<string | null>(faceUrlProp ?? null);

  const scores = scoresProp ?? defeatScoresFromRespect(respectScore);
  const scoreLine = formatDefeatScoreLine(scores);

  useEffect(() => {
    setFaceUrl(resolveDefeatFaceUrl(faceUrlProp));
  }, [faceUrlProp]);

  const share = useCallback(async () => {
    if (!cardRef.current) return;
    setBusy(true);
    setStatus(null);
    try {
      const live = resolveDefeatFaceUrl(faceUrlProp);
      if (live) setFaceUrl(live);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => window.setTimeout(r, 50));

      if (!cardRef.current) throw new Error("Share card missing");
      const dataUrl = await captureShareDefeatPng(cardRef.current);
      const result = await shareDefeatPng({
        dataUrl,
        title: headline,
        text: `${headline}\n${scoreLine}\n${tagline}\n${SHARE_DEFEAT_WATERMARK}`,
      });
      setStatus(result);
      onShared?.(result);
    } catch (err) {
      console.warn("[ShareCard]", err);
      setStatus("Could not export card — try again.");
    } finally {
      setBusy(false);
    }
  }, [faceUrlProp, headline, onShared, scoreLine, tagline]);

  return (
    <div className={className}>
      <ShareDefeatPoster
        cardRef={cardRef}
        faceUrl={faceUrl}
        scoreLine={scoreLine}
        headline={headline}
        tagline={tagline}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => void share()}
        className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#ff1a3c] via-[#ff2d55] to-[#ff4d6d] px-4 py-4 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_0_40px_rgba(255,45,85,0.65)] transition hover:scale-[1.02] disabled:opacity-50 active:scale-[0.99]"
      >
        <Share2 className="h-5 w-5" />
        {busy ? "Rendering…" : ctaLabel}
      </button>
      {status ? (
        <p className="mt-2 text-center text-xs text-zinc-400">{status}</p>
      ) : null}
    </div>
  );
}

export default ShareCard;
