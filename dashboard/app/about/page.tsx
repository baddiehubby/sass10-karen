import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Why Buddie AI exists and how we humanize AI with emotional intelligence analytics.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-14">
      <article className="glass-panel p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddy AI · emotional intelligence</p>
        <h1 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">We humanize your AI — with proof</h1>
        <p className="mt-5 text-slate-300">
          Most AI products are brilliant but emotionally blind. Buddy AI adds a tiny companion users bond with, while
          your team gets emotional intelligence analytics — sentiment, mood timelines, and the language patterns behind
          joy and concern. That is how you humanize your AI for customers and for the business at the same time.
        </p>

        <h2 className="mt-9 text-xl font-semibold text-white">How it works</h2>
        <p className="mt-3 text-slate-300">
          A lightweight Buddy embed runs beside your existing AI chat. It reads assistant output in the page and
          mirrors emotional tone in real time. Anonymous mood events stream to your dashboard so you can see how
          people feel across sessions — GDPR-friendly telemetry (mood labels and embedding domain only).
        </p>

        <h2 className="mt-9 text-xl font-semibold text-white">Our mission</h2>
        <p className="mt-3 text-slate-300">
          We believe the next generation of AI should feel trustworthy and emotionally legible. Buddy AI is the
          emotional intelligence layer that gives every AI a soul in the UI and every product team a window into how
          customers feel — so you can humanize your AI with data, empathy, and craft.
        </p>
      </article>
    </main>
  );
}
