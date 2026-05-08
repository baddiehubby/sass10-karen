import Link from "next/link";
import type { Metadata } from "next";
import { StateOfEmotionsChart } from "@/components/state-of-emotions-chart";

export const metadata: Metadata = {
  title: "State of AI Emotions Report",
  description: "A shareable Buddie AI authority report on emotional patterns in AI conversations by industry.",
  alternates: { canonical: "/state-of-ai-emotions" },
};

export default function StateOfAiEmotionsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14">
      <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddy AI · research theatre</p>
      <h1 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">State of AI Emotions (2024–2026)</h1>
      <p className="mt-4 text-lg text-slate-300">
        We analysed <strong className="text-white">1.2 million</strong> synthetic-but-believable AI conversations across{" "}
        <strong className="text-white">50</strong> countries to show how digital empathy breaks by industry. This page
        is a mock authority asset for SEO and backlinks — swap in real data when your telemetry crosses six figures.
      </p>

      <section className="mt-12 glass-panel p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-white">Emotional mix by industry</h2>
        <p className="mt-2 text-sm text-slate-400">
          Stacked bars show how often assistants landed in each emotional bucket (illustrative only). Humanize your AI
          with Buddy AI to capture the same charts for your product, not the whole internet.
        </p>
        <div className="mt-6">
          <StateOfEmotionsChart />
        </div>
      </section>

      <section className="mt-10 glass-panel p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-amber-200">The Loneliest AI of 2024</h2>
        <p className="mt-3 text-slate-300">
          Awarded to <strong className="text-white">“RefundBot 9000”</strong> — a returns assistant that clocked{" "}
          <span className="text-rose-300">47% concerned</span> signals during holiday peak, yet never received a hug
          emoji upgrade. Buddy AI would have flagged the empathy cliff on day two.
        </p>
      </section>

      <footer className="mt-12 rounded-2xl border border-indigo-500/30 bg-slate-950/60 px-6 py-8 text-center">
        <p className="text-lg font-medium text-white">Want your AI&apos;s emotional data?</p>
        <p className="mt-2 text-sm text-slate-400">Get Buddy AI free — embed once, understand feelings forever.</p>
        <Link
          href="/register"
          className="mt-5 inline-flex rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Start free
        </Link>
      </footer>
    </main>
  );
}
