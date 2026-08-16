"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void import("@sentry/nextjs")
      .then((Sentry) => {
        Sentry.captureException(error);
      })
      .catch(() => {
        /* optional */
      });
  }, [error]);

  return (
    <div className="buddie-home mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <p className="buddie-brand text-2xl text-[#f4efe6]">Buddie</p>
      <p className="mt-4 text-sm font-light text-white/55">
        Home paused for a breath. Nothing is lost — try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 min-h-11 rounded-full border border-white/20 px-6 text-sm text-white/80 transition hover:border-[#e8c4a0]/50 hover:text-[#e8c4a0]"
      >
        Return to Buddie
      </button>
    </div>
  );
}
