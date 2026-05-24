"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { CinematicOrb, getTimeTheme } from "@/components/cinematic-orb";

const MOOD_THEMES = {
  happy: "afternoon",
  excited: "afternoon",
  neutral: "morning",
  thinking: "morning",
  sleepy: "night",
  concerned: "night",
  angry: "night",
} as const;

type DashboardLiveOrbProps = {
  mood: string;
  licenseKey: string | null;
  scriptUrl: string;
  apiBase: string;
};

export function DashboardLiveOrb({ mood, licenseKey, scriptUrl, apiBase }: DashboardLiveOrbProps) {
  const mouseRef = useRef({ x: 0, y: 0 });
  const [breathing, setBreathing] = useState(true);
  const themeKey = MOOD_THEMES[mood as keyof typeof MOOD_THEMES] ?? getTimeTheme();
  const theme =
    themeKey === "afternoon" || themeKey === "morning" || themeKey === "night" ? themeKey : getTimeTheme();

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
      setBreathing(false);
    };
    window.addEventListener("mousemove", onMove);
    const t = window.setTimeout(() => setBreathing(true), 5000);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.clearTimeout(t);
    };
  }, []);

  return (
    <div className="relative mx-auto h-[200px] w-[200px]">
      {licenseKey ? (
        <Script
          src={scriptUrl}
          data-hq-key={licenseKey}
          data-hq-api={apiBase}
          data-hq-css={`${apiBase}/widget/buddy-widget.css`}
          strategy="afterInteractive"
        />
      ) : null}
      <CinematicOrb
        theme={theme}
        breathing={breathing}
        mouseRef={mouseRef}
        height="200px"
        className="max-w-[200px]"
      />
    </div>
  );
}
