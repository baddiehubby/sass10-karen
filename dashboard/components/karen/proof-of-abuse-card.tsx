"use client";

/**
 * Hidden 320×480 cyberpunk `#share-card` poster + "Share this Roast" CTA.
 * Captured with html-to-image `toPng` → navigator.share (mobile) / download (desktop).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";

import {
  PROOF_OF_ABUSE_SIZE,
  PROOF_OF_ABUSE_WATERMARK,
  SHARE_CARD_DOM_ID,
  captureProofOfAbusePng,
  resolveAbuseFaceUrl,
  shareProofOfAbusePng,
  type ProofOfAbuseCardData,
} from "@/lib/karen/proof-of-abuse";
import { KAREN_SHARE_ORIGIN } from "@/lib/karen/share-loop";

const NEON = "#ff2d55";

type ProofOfAbuseCardProps = ProofOfAbuseCardData & {
  /** Called after a successful share/download. */
  onShared?: (status: string) => void;
};

/** Off-screen poster — do not remove from the DOM while sharing. */
export function ProofOfAbuseCardPoster({
  cardRef,
  title,
  line,
  respectScore,
  metrics,
  faceUrl,
}: {
  cardRef: React.RefObject<HTMLDivElement>;
  title: string;
  line?: string;
  respectScore?: number;
  metrics?: Array<{ label: string; value: number | string }>;
  faceUrl: string | null;
}) {
  const showRespect = typeof respectScore === "number" && Number.isFinite(respectScore);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -left-[9999px] top-0 z-[-1] overflow-hidden"
    >
      <div
        id={SHARE_CARD_DOM_ID}
        ref={cardRef}
        style={{
          width: PROOF_OF_ABUSE_SIZE.width,
          height: PROOF_OF_ABUSE_SIZE.height,
          background:
            "linear-gradient(165deg, #2a0610 0%, #0e0609 45%, #030203 100%)",
          color: "#fff",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
          border: `1px solid rgba(255,45,85,0.55)`,
          boxSizing: "border-box",
        }}
      >
        {/* Cyber grid / neon wash */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,45,85,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,45,85,0.06) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 16%, rgba(255,45,85,0.45), transparent 55%)",
          }}
        />

        <div
          style={{
            position: "relative",
            padding: 20,
            height: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 10,
              letterSpacing: "0.35em",
              textTransform: "uppercase",
              color: "#ff4d6d",
              fontWeight: 700,
            }}
          >
            Share Your Damage · SASS10
          </p>

          <div
            style={{
              marginTop: 14,
              width: 148,
              height: 148,
              borderRadius: "50%",
              overflow: "hidden",
              marginLeft: "auto",
              marginRight: "auto",
              border: "2px solid rgba(255,45,85,0.85)",
              boxShadow: `0 0 36px rgba(255,45,85,0.55)`,
              background: "#12080c",
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
                  objectPosition: "center top",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background:
                    "radial-gradient(circle at 50% 38%, #5a1830, #12080c 70%)",
                }}
              />
            )}
          </div>

          <h1
            style={{
              margin: "14px 0 0",
              fontSize: 20,
              lineHeight: 1.12,
              fontWeight: 900,
              textAlign: "center",
              textTransform: "uppercase",
              textShadow: `0 0 18px rgba(255,45,85,0.75)`,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </h1>

          {showRespect ? (
            <div
              style={{
                marginTop: 12,
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.55)",
                  fontWeight: 700,
                }}
              >
                Respect Score
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 42,
                  lineHeight: 1,
                  fontWeight: 900,
                  fontVariantNumeric: "tabular-nums",
                  color: respectScore! < 0 ? NEON : "#fff",
                  textShadow:
                    respectScore! < 0
                      ? `0 0 22px rgba(255,45,85,0.85)`
                      : `0 0 16px rgba(255,255,255,0.25)`,
                }}
              >
                {respectScore}
              </p>
            </div>
          ) : null}

          {metrics && metrics.length > 0 ? (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {metrics.map((m) => (
                <MetricRow key={m.label} label={m.label} value={m.value} />
              ))}
            </div>
          ) : null}

          {line ? (
            <p
              style={{
                marginTop: 12,
                fontSize: 13,
                lineHeight: 1.35,
                textAlign: "center",
                color: "#fecdd3",
                fontStyle: "italic",
              }}
            >
              “{line}”
            </p>
          ) : null}

          <p
            style={{
              marginTop: "auto",
              paddingTop: 12,
              textAlign: "center",
              fontSize: 10,
              letterSpacing: "0.04em",
              color: "rgba(255,255,255,0.62)",
            }}
          >
            {PROOF_OF_ABUSE_WATERMARK}
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  const numeric = typeof value === "number";
  const barPct = numeric
    ? Math.max(0, Math.min(100, value < 0 ? 0 : value))
    : 0;
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          marginBottom: 4,
        }}
      >
        <span style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {label}
        </span>
        <strong>{value}</strong>
      </div>
      {numeric ? (
        <div
          style={{
            height: 8,
            borderRadius: 99,
            background: "rgba(255,255,255,0.12)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${barPct}%`,
              height: "100%",
              background: NEON,
              boxShadow: `0 0 10px ${NEON}`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Hidden `#share-card` + primary CTA. Mount on Game Over / check-in finish.
 */
export function ShareYourDamageButton({
  title,
  line,
  respectScore,
  metrics,
  faceUrl: faceUrlProp,
  kind = "roast",
  onShared,
  className = "",
}: ProofOfAbuseCardProps & { className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [faceUrl, setFaceUrl] = useState<string | null>(faceUrlProp ?? null);

  useEffect(() => {
    setFaceUrl(resolveAbuseFaceUrl(faceUrlProp));
  }, [faceUrlProp]);

  const share = useCallback(async () => {
    if (!cardRef.current) return;
    setBusy(true);
    setStatus(null);
    try {
      // Refresh face right before capture so we get the angry frame.
      const live = resolveAbuseFaceUrl(faceUrlProp);
      if (live) setFaceUrl(live);
      // Let the img paint before toPng.
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => window.setTimeout(r, 40));

      if (!cardRef.current) throw new Error("Share card missing");
      const dataUrl = await captureProofOfAbusePng(cardRef.current);
      const result = await shareProofOfAbusePng({
        dataUrl,
        title,
        text: `${title}${line ? ` — ${line}` : ""}${
          typeof respectScore === "number" ? `\nRespect Score: ${respectScore}` : ""
        }\n${PROOF_OF_ABUSE_WATERMARK}\n${KAREN_SHARE_ORIGIN}`,
        url: KAREN_SHARE_ORIGIN,
        fileName:
          kind === "checkin"
            ? "sass10-checkin-damage.png"
            : "sass10-share-this-roast.png",
      });
      setStatus(result);
      onShared?.(result);
    } catch (err) {
      console.warn("[ShareYourDamage]", err);
      setStatus("Could not export card — try again.");
    } finally {
      setBusy(false);
    }
  }, [faceUrlProp, kind, line, onShared, respectScore, title]);

  const cta =
    kind === "checkin" ? "Share Your Damage" : "Share this Roast";

  return (
    <div className={className}>
      <ProofOfAbuseCardPoster
        cardRef={cardRef}
        title={title}
        line={line}
        respectScore={respectScore}
        metrics={metrics}
        faceUrl={faceUrl}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => void share()}
        className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#ff1a3c] via-[#ff2d55] to-[#ff4d6d] px-4 py-4 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_0_40px_rgba(255,45,85,0.65)] transition hover:scale-[1.02] disabled:opacity-50 active:scale-[0.99]"
      >
        <Share2 className="h-5 w-5" />
        {busy ? "Rendering…" : cta}
      </button>
      {status ? (
        <p className="mt-2 text-center text-xs text-zinc-400">{status}</p>
      ) : null}
    </div>
  );
}
