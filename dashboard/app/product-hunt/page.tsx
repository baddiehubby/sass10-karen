import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Product Hunt Launch",
  description: "Buddie AI launch story, how it works, 7-day challenge flow, and free start.",
  alternates: { canonical: "/product-hunt" },
};

const testimonials = [
  "We reduced support escalations by 22% by detecting frustrated users early. — SaaS Inc.",
  "Our AI companion made users spend 3x longer on our site. — CreatorHub",
  "I never thought an AI could understand mood. Now I cannot live without it. — E-commerce brand",
];

export default function ProductHuntPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-14">
      <section className="glass-panel p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddie AI · Product Hunt</p>
        <h1 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">
          Buddie AI: The First Emotional Intelligence Layer for AI Chat
        </h1>
        <p className="mt-4 max-w-3xl text-slate-300">
          Give your AI a soul. Buddie sits beside conversations, reacts in real time, and powers analytics that show
          how people feel before churn or escalation hits.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-flex rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Get Buddy AI Free – No Credit Card Required
        </Link>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="glass-panel p-6">
          <h2 className="text-xl font-semibold text-white">What is Buddy AI?</h2>
          <p className="mt-2 text-sm text-slate-300">
            A tiny emotional companion widget paired with a full analytics command center. We humanize your AI and make
            emotional quality measurable.
          </p>
        </article>
        <article className="glass-panel p-6">
          <h2 className="text-xl font-semibold text-white">How it works</h2>
          <p className="mt-2 text-sm text-slate-300">Embed once, track moods, review sentiment timelines, and act on top concern words.</p>
          <div className="mt-4 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_30%_22%,#e2e8f0_0%,#6366f1_42%,#1e1b4b_100%)] shadow-[0_0_32px_rgba(99,102,241,0.55)]" />
        </article>
      </section>

      <section className="mt-8 glass-panel p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-white">Why we built it</h2>
        <p className="mt-3 text-sm text-slate-300">
          AI products grew faster than empathy tooling. We built Buddie AI to close that gap so teams can ship smarter,
          kinder, and more trustworthy AI experiences.
        </p>
      </section>

      <section className="mt-8 glass-panel p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-white">Your first 7 days</h2>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-300">
          <li>Day 1: Embed the Buddy and start receiving mood events.</li>
          <li>Day 2-4: Identify concern clusters and improve key flows.</li>
          <li>Day 5-7: Generate emotional report card and share outcomes.</li>
        </ul>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {testimonials.map((quote) => (
          <article key={quote} className="glass-panel p-6 text-sm text-slate-200">
            “{quote}”
          </article>
        ))}
      </section>

      <section className="mt-8 glass-panel p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-white">Pricing snapshot</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm">
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <p className="font-semibold text-white">Buddy</p>
            <p className="mt-1 text-slate-300">$0 · emotional telemetry starter</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <p className="font-semibold text-white">Pro</p>
            <p className="mt-1 text-slate-300">$29/mo · full analytics + custom face</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <p className="font-semibold text-white">Agency</p>
            <p className="mt-1 text-slate-300">$99/mo · white-label + API + team controls</p>
          </div>
        </div>
      </section>

      <section className="mt-8 glass-panel p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-white">Founder note</h2>
        <p className="mt-3 text-sm text-slate-300">
          We believe emotionally aware AI will become table stakes. Buddie AI is our first step toward making every AI
          conversation feel understood.
        </p>
      </section>
    </main>
  );
}
