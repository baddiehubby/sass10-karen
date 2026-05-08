import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GDPR",
  description: "GDPR posture and data-protection commitments for Buddie AI.",
  alternates: { canonical: "/gdpr" },
};

export default function GdprPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-14">
      <article className="glass-panel p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddie AI · compliance</p>
        <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">GDPR Overview</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          Buddie AI is designed with privacy-by-default controls for emotional analytics telemetry. We minimize personal
          data, support deletion/export requests, and provide clear processing boundaries for customers deploying Buddy in
          the EU and globally.
        </p>
      </article>
    </main>
  );
}
