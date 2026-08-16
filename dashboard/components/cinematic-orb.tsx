"use client";

/**
 * Public orb entry — CSS BuddyOrb always paints first; WebGL enhances when ready.
 * Never blank. WebGPU is never required. Core experience works without WebGL.
 */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BuddyOrb } from "@/components/buddy-orb";
import { resolveOrbRenderMode } from "@/lib/orb-render-policy";
import { getTimeTheme, TIME_THEME_COLORS, type TimeTheme } from "@/lib/time-theme";

export { getTimeTheme, TIME_THEME_COLORS, type TimeTheme };

const CinematicOrbWebGl = dynamic(
  () => import("@/components/cinematic-orb-webgl").then((m) => m.CinematicOrbWebGl),
  {
    ssr: false,
    // Keep CSS orb visible — never return null (blank screen).
    loading: () => null,
  },
);

type CinematicOrbProps = {
  className?: string;
  theme?: TimeTheme;
  breathing?: boolean;
  scrollPulse?: number;
  mouseRef?: React.MutableRefObject<{ x: number; y: number }>;
  height?: string;
  shimmer?: boolean;
};

function CssThemeOrb({
  theme,
  height,
  className,
  shimmer,
}: {
  theme: TimeTheme;
  height: string;
  className: string;
  shimmer: boolean;
}) {
  const colors = TIME_THEME_COLORS[theme];
  return (
    <div
      className={`relative mx-auto flex w-full max-w-[min(92vw,520px)] items-center justify-center ${className}`}
      style={{ height }}
      aria-hidden={false}
    >
      <div
        className="pointer-events-none absolute inset-[-12%] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)` }}
        aria-hidden
      />
      {shimmer ? <div className="orb-gold-shimmer pointer-events-none absolute inset-0 rounded-full" aria-hidden /> : null}
      {/* Presence orb — visual only on marketing surfaces; talk UI is separate. */}
      <BuddyOrb mood="calm" size={240} interactive={false} />
    </div>
  );
}

export function CinematicOrb({
  className = "",
  theme: themeProp,
  breathing = false,
  scrollPulse = 0,
  mouseRef,
  height = "min(68vh, 520px)",
  shimmer = false,
}: CinematicOrbProps) {
  const theme = themeProp ?? getTimeTheme();
  const [wantWebGl, setWantWebGl] = useState(false);
  const [webglReady, setWebglReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    setWantWebGl(resolveOrbRenderMode() === "webgl");
  }, []);

  useEffect(() => {
    if (!wantWebGl || webglFailed) return;
    const onError = () => setWebglFailed(true);
    window.addEventListener("webglcontextlost", onError);
    return () => window.removeEventListener("webglcontextlost", onError);
  }, [wantWebGl, webglFailed]);

  const showWebGl = wantWebGl && !webglFailed;

  return (
    <div className="relative w-full" style={{ minHeight: height }}>
      {/* Always paint CSS first — never a blank frame while WebGL chunks load. */}
      <div
        className={showWebGl && webglReady ? "invisible absolute inset-0" : "relative"}
        aria-hidden={showWebGl && webglReady}
      >
        <CssThemeOrb theme={theme} height={height} className={className} shimmer={shimmer} />
      </div>
      {showWebGl ? (
        <div className={webglReady ? "relative" : "pointer-events-none absolute inset-0 opacity-0"}>
          <CinematicOrbWebGl
            className={className}
            theme={theme}
            breathing={breathing}
            scrollPulse={scrollPulse}
            mouseRef={mouseRef}
            height={height}
            shimmer={shimmer}
            onReady={() => setWebglReady(true)}
            onFailed={() => setWebglFailed(true)}
          />
        </div>
      ) : null}
    </div>
  );
}
