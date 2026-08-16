"use client";

import { useEffect } from "react";

export default function Error({
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
        /* Sentry optional */
      });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs uppercase tracking-[0.24em] text-white/40">Buddie</p>
      <h1 className="mt-3 text-2xl font-light text-[#f4efe6]">Something soft went wrong</h1>
      <p className="mt-3 text-sm text-white/50">
        Your place is still here. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 min-h-11 rounded-full bg-[#e8c4a0]/90 px-6 text-sm font-medium text-[#1a1410] transition hover:bg-[#e8c4a0]"
      >
        Try again
      </button>
    </main>
  );
}
