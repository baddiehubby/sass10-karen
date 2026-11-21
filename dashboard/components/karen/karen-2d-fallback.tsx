"use client";

import { KAREN_2D_AVATAR_SRC } from "@/lib/karen/fallback-2d";

/**
 * Static high-quality Karen portrait when WebGL / TalkingHead cannot run (iOS Safari crash).
 * Audio still plays via `new Audio()` — Hold-to-Scream stays functional.
 */
export function Karen2DFallback({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 w-screen h-screen z-0 flex items-end justify-center overflow-hidden bg-black ${className}`.trim()}
      data-karen-2d-fallback=""
      aria-hidden
    >
      {/* Soft vignette atmosphere behind the still */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 42%, rgba(80,10,20,0.55) 0%, #000 72%)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={KAREN_2D_AVATAR_SRC}
        alt=""
        className="relative z-[1] h-[min(92vh,920px)] w-auto max-w-[min(100vw,560px)] object-contain object-bottom select-none"
        draggable={false}
        decoding="async"
      />
    </div>
  );
}
