"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

import {
  acceptComedyDisclaimer,
  hasAcceptedComedyDisclaimer,
  KAREN_COMEDY_DISCLAIMER_BODY,
  KAREN_COMEDY_DISCLAIMER_TITLE,
  KAREN_COMEDY_EXIT_URL,
} from "@/lib/karen/comedy-disclaimer";

type ComedyDisclaimerGateProps = {
  children: ReactNode;
};

/**
 * Unskippable full-screen comedy disclaimer (Google Play abusive-AI policy).
 * Blocks all Karen UI until localStorage accept. Exit leaves the app.
 */
export function ComedyDisclaimerGate({ children }: ComedyDisclaimerGateProps) {
  // null = hydrating — keep a black screen so content never flashes before consent.
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    setAccepted(hasAcceptedComedyDisclaimer());
  }, []);

  if (accepted === true) return <>{children}</>;

  if (accepted === null) {
    return (
      <div
        className="fixed inset-0 z-[200] bg-black"
        aria-busy="true"
        aria-label="Loading disclaimer"
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex karen-vh w-screen items-center justify-center overflow-hidden bg-[#070606] px-6 text-center text-white"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="karen-comedy-disclaimer-title"
      aria-describedby="karen-comedy-disclaimer-body"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(180,20,40,0.22), transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.9), #070606 70%)",
        }}
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 flex w-full max-w-md flex-col items-center gap-6"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-red-400/90">
          Content notice
        </p>

        <h1
          id="karen-comedy-disclaimer-title"
          className="text-2xl font-black uppercase leading-tight tracking-tight text-white sm:text-3xl"
        >
          {KAREN_COMEDY_DISCLAIMER_TITLE}
        </h1>

        <p
          id="karen-comedy-disclaimer-body"
          className="text-sm leading-relaxed text-zinc-300 sm:text-[15px]"
        >
          {KAREN_COMEDY_DISCLAIMER_BODY}
        </p>

        <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => {
              acceptComedyDisclaimer();
              setAccepted(true);
            }}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-md bg-[#e11d2e] px-6 text-sm font-black uppercase tracking-[0.18em] text-white outline-none ring-offset-2 ring-offset-[#070606] focus-visible:ring-2 focus-visible:ring-red-400 active:scale-[0.98]"
          >
            I Accept
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.assign(KAREN_COMEDY_EXIT_URL);
            }}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-md border border-zinc-600 bg-transparent px-6 text-sm font-bold uppercase tracking-[0.18em] text-zinc-200 outline-none ring-offset-2 ring-offset-[#070606] focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
          >
            Exit
          </button>
        </div>
      </motion.div>
    </div>
  );
}
