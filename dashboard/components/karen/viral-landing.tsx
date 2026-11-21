"use client";

/**
 * High-converting TikTok-ad landing for US iPhone traffic.
 * One composition: brand + fight CTA + floating social proof.
 */

import Link from "next/link";
import { motion } from "framer-motion";

const MARQUEE =
  "🔥 AS SEEN ON TIKTOK • 10 MILLION VIEWS • THE ULTIMATE FIGHT 🔥";

const COMMENTS = [
  {
    user: "@User123",
    text: "I screamed at my phone for 5 mins and she muted me. 10/10.",
    rotate: -6,
    x: "4%",
    y: "18%",
    delay: 0.15,
  },
  {
    user: "@FitnessBro",
    text: "This app called me a coward for skipping leg day. I'm suing.",
    rotate: 5,
    x: "58%",
    y: "22%",
    delay: 0.35,
  },
  {
    user: "@TechGuy",
    text: "She literally hangs up on you. Toxic and amazing.",
    rotate: -3,
    x: "12%",
    y: "68%",
    delay: 0.55,
  },
] as const;

export function KarenViralLanding() {
  return (
    <main
      className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(ellipse 90% 55% at 50% 18%, rgba(255,45,85,0.38) 0%, transparent 58%), radial-gradient(ellipse 70% 45% at 80% 90%, rgba(255,20,100,0.16) 0%, transparent 50%), linear-gradient(180deg, #0a0408 0%, #050203 45%, #000 100%)",
      }}
    >
      {/* Soft scanline / grain atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "100% 3px",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[28%] h-[42vmax] w-[42vmax] -translate-x-1/2 rounded-full blur-[90px]"
        style={{
          background:
            "radial-gradient(circle, rgba(255,45,85,0.55) 0%, rgba(255,45,85,0.12) 42%, transparent 70%)",
        }}
        aria-hidden
      />

      {/* Scrolling TikTok marquee */}
      <div className="relative z-20 border-b border-white/10 bg-black/55 backdrop-blur-md">
        <div className="overflow-hidden py-2.5">
          <motion.div
            className="flex whitespace-nowrap"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 18, ease: "linear", repeat: Infinity }}
          >
            <MarqueeChunk />
            <MarqueeChunk />
          </motion.div>
        </div>
      </div>

      {/* Floating TikTok comment cards */}
      <div className="pointer-events-none absolute inset-0 z-10 hidden sm:block" aria-hidden>
        {COMMENTS.map((c) => (
          <motion.article
            key={c.user}
            initial={{ opacity: 0, y: 18, rotate: c.rotate }}
            animate={{
              opacity: 1,
              y: [0, -10, 0],
              rotate: c.rotate,
            }}
            transition={{
              opacity: { delay: c.delay, duration: 0.5 },
              y: {
                delay: c.delay + 0.4,
                duration: 5.5 + c.delay,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
            className="absolute max-w-[220px] rounded-2xl border border-white/15 bg-black/70 px-3.5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            style={{ left: c.x, top: c.y }}
          >
            <p className="text-[11px] font-bold tracking-wide text-[#ff4d6d]">
              {c.user}
            </p>
            <p className="mt-1 text-[12px] leading-snug text-zinc-100">
              <em>{c.text}</em>
            </p>
          </motion.article>
        ))}
      </div>

      {/* Mobile social proof — stacked under fold of hero copy, still first viewport on tall phones */}
      <div className="relative z-20 mx-auto mt-4 flex w-full max-w-md flex-col gap-2 px-4 sm:hidden">
        {COMMENTS.slice(0, 2).map((c) => (
          <motion.article
            key={c.user}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: c.delay, duration: 0.4 }}
            className="rounded-2xl border border-white/12 bg-black/55 px-3 py-2.5 backdrop-blur-md"
          >
            <p className="text-[11px] font-bold text-[#ff4d6d]">{c.user}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-zinc-200">
              <em>{c.text}</em>
            </p>
          </motion.article>
        ))}
      </div>

      {/* Hero composition */}
      <section className="relative z-20 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 text-center sm:pt-4">
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-[11px] font-semibold uppercase tracking-[0.42em] text-[#ff4d6d]"
        >
          SASS10
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5 }}
          className="mt-4 max-w-[16ch] text-[clamp(2.4rem,9vw,4.75rem)] font-black uppercase leading-[0.92] tracking-[-0.03em] text-white"
          style={{
            textShadow:
              "0 0 40px rgba(255,45,85,0.55), 0 0 2px rgba(255,45,85,0.9)",
            fontFamily:
              'var(--font-karen-display), "Arial Black", Impact, sans-serif',
          }}
        >
          Meet Karen. The Brutal Coach.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.45 }}
          className="mt-5 max-w-md text-[15px] leading-relaxed text-zinc-300 sm:text-base"
        >
          She doesn&apos;t want your excuses. She wants you to fight back. Are you
          brave enough to win an argument against an AI?
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.28, duration: 0.4 }}
          className="mt-9 w-full max-w-sm"
        >
          <motion.div
            animate={{
              scale: [1, 1.045, 1],
              boxShadow: [
                "0 0 28px rgba(255,45,85,0.45)",
                "0 0 52px rgba(255,45,85,0.85)",
                "0 0 28px rgba(255,45,85,0.45)",
              ],
            }}
            transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
            className="rounded-full"
          >
            <Link
              href="/karen"
              className="flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-gradient-to-r from-[#ff1a3c] via-[#ff2d55] to-[#ff4d6d] px-6 text-[15px] font-black uppercase tracking-[0.14em] text-white outline-none ring-offset-2 ring-offset-black focus-visible:ring-2 focus-visible:ring-[#ff4d6d] active:scale-[0.98]"
            >
              START THE FIGHT 🥊
            </Link>
          </motion.div>
          <p className="mt-3 text-center text-[12px] text-zinc-400">
            No downloads required. Play instantly in your browser.
          </p>
        </motion.div>

        {/* Third comment on mobile, tucked under CTA so hero stays readable */}
        <motion.article
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-8 w-full max-w-sm rounded-2xl border border-white/12 bg-black/55 px-3.5 py-3 text-left backdrop-blur-md sm:hidden"
        >
          <p className="text-[11px] font-bold text-[#ff4d6d]">{COMMENTS[2].user}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-zinc-200">
            <em>{COMMENTS[2].text}</em>
          </p>
        </motion.article>
      </section>
    </main>
  );
}

function MarqueeChunk() {
  return (
    <span className="inline-flex shrink-0 items-center px-4 text-[11px] font-bold uppercase tracking-[0.28em] text-zinc-200 sm:text-xs">
      {MARQUEE}
      <span className="mx-4 text-[#ff4d6d]" aria-hidden>
        •
      </span>
      {MARQUEE}
      <span className="mx-4 text-[#ff4d6d]" aria-hidden>
        •
      </span>
    </span>
  );
}
