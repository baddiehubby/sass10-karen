"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="app-gradient min-h-screen px-6 py-20 text-slate-100">
        <main className="mx-auto w-full max-w-2xl">
          <section className="glass-panel p-8 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-indigo-300">Buddie AI · error</p>
            <h1 className="mt-3 text-2xl font-semibold text-white">Something went wrong</h1>
            <p className="mt-3 text-sm text-slate-300">
              We captured the issue for review. Please retry, and if it continues contact support@buddieai.com.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
