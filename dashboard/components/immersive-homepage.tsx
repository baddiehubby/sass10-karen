"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CinematicOrb, getTimeTheme, TIME_THEME_COLORS, type TimeTheme } from "@/components/cinematic-orb";
import { PrivacyBadge } from "@/components/privacy-badge";
import { brandingFromHostname } from "@/lib/tenant-brand";

const WHISPERS = [
  "You seem far away tonight.",
  "I feel quiet energy from you.",
  "Something's on your mind.",
  "You're moving fast today.",
  "I'm listening.",
  "Breathe. I'm here.",
  "The room feels still.",
  "I notice you.",
  "Stay a moment.",
  "I'm curious about you.",
];

function pickWhisper(prev: string | null) {
  const pool = prev ? WHISPERS.filter((w) => w !== prev) : WHISPERS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function nextDelayMs() {
  return 15000 + Math.floor(Math.random() * 10000);
}

export function ImmersiveHomepage() {
  const router = useRouter();
  const [brand, setBrand] = useState(() => brandingFromHostname(""));
  const [theme] = useState<TimeTheme>(() => getTimeTheme());
  const colors = TIME_THEME_COLORS[theme];
  const mouseRef = useRef({ x: 0, y: 0 });
  const lastInteractionRef = useRef(Date.now());
  const [breathing, setBreathing] = useState(false);
  const [scrollPulse, setScrollPulse] = useState(0);
  const [whisper, setWhisper] = useState<string | null>(null);
  const [whisperVisible, setWhisperVisible] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  useEffect(() => {
    setBrand(brandingFromHostname(typeof window !== "undefined" ? window.location.hostname : ""));
  }, []);

  const prevWhisperRef = useRef<string | null>(null);
  const ctaShownRef = useRef(false);

  const bgStyle = useMemo(
    () => ({
      background: `#0a0a1a radial-gradient(ellipse 80% 60% at 50% 40%, ${colors.glow} 0%, transparent 65%)`,
    }),
    [colors.glow],
  );

  const markInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
    setBreathing(false);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      markInteraction();
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseRef.current.x = nx;
      mouseRef.current.y = -ny;
    };
    const onScroll = () => {
      markInteraction();
      setScrollPulse((p) => p + 1);
      window.setTimeout(() => setScrollPulse((p) => Math.max(0, p - 1)), 600);
    };
    const onWheel = () => onScroll();

    window.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
    };
  }, [markInteraction]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (Date.now() - lastInteractionRef.current > 5000) setBreathing(true);
    }, 800);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let hideTimer: number | undefined;
    let cycleTimer: number | undefined;

    function showNext(afterMs: number) {
      cycleTimer = window.setTimeout(() => {
        if (cancelled) return;
        const line = pickWhisper(prevWhisperRef.current);
        prevWhisperRef.current = line;
        setWhisper(line);
        setWhisperVisible(true);

        if (!ctaShownRef.current) {
          ctaShownRef.current = true;
          window.setTimeout(() => setShowCta(true), 4000);
        }

        hideTimer = window.setTimeout(() => {
          setWhisperVisible(false);
          window.setTimeout(() => {
            if (!cancelled) showNext(nextDelayMs());
          }, 700);
        }, 4500);
      }, afterMs);
    }

    showNext(8000 + Math.floor(Math.random() * 4000));

    return () => {
      cancelled = true;
      if (hideTimer) window.clearTimeout(hideTimer);
      if (cycleTimer) window.clearTimeout(cycleTimer);
    };
  }, []);

  return (
    <motion.div
      className="immersive-home fixed inset-0 z-50 flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden overscroll-none text-white"
      style={bgStyle}
      onMouseMove={markInteraction}
      onClick={markInteraction}
      onTouchStart={markInteraction}
      onTouchMove={markInteraction}
    >
      <div className="immersive-home-orb-wrap flex w-full flex-col items-center px-4">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="pointer-events-none mb-2 max-w-[90vw] text-center text-xs font-light tracking-wide text-slate-400 sm:mb-3 sm:text-sm"
        >
          {brand.tenant === "sachapandit" ? "Sacha Pandit, always listening." : "Your AI companion, always listening."}
        </motion.p>
        <CinematicOrb
          theme={theme}
          breathing={breathing}
          scrollPulse={scrollPulse}
          mouseRef={mouseRef}
          shimmer
          className="immersive-home-orb"
        />
      </div>

      <div className="pointer-events-none relative mt-1 flex min-h-[3.5rem] w-full max-w-md flex-col items-center px-4 sm:mt-2 sm:min-h-[4rem] sm:px-6">
        <AnimatePresence mode="wait">
          {whisperVisible && whisper ? (
            <motion.p
              key={whisper}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="text-center text-sm font-light tracking-wide text-white/70 md:text-base"
            >
              {whisper}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {showCta ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              className="pointer-events-auto mt-8 flex flex-col items-center"
            >
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="text-sm tracking-wide text-white/45 transition-colors hover:text-white/75"
              >
                {brand.tenant === "sachapandit" ? "Meet your Pandit →" : "Meet your Buddy →"}
              </button>
              <p className="mt-3 max-w-xs text-center text-xs text-slate-500">
                {brand.tenant === "sachapandit"
                  ? "Free forever. Wisdom from every culture. No credit card needed. Your soul is safe here."
                  : "A premium living companion. Sign in, then choose Starter from $20/month."}
              </p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.9, ease: "easeOut", delay: 1 }}
                className="mt-4"
              >
                <PrivacyBadge variant="homepage" />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div
        className="pointer-events-auto fixed inset-x-0 bottom-0 flex h-20 items-end justify-center pb-[max(1rem,env(safe-area-inset-bottom))]"
        onMouseEnter={() => setShowAbout(true)}
        onMouseLeave={() => setShowAbout(false)}
        onTouchStart={() => setShowAbout(true)}
      />
      <AnimatePresence>
        {showAbout ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto fixed bottom-6 left-0 right-0 flex justify-center gap-6 text-xs text-white/30"
            onMouseLeave={() => setShowAbout(false)}
          >
            <Link href="/about" className="hover:text-white/60">
              About
            </Link>
            <Link href="/pricing" className="hover:text-white/60">
              Pricing
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
