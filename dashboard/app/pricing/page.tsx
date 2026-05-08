"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";

export default function PricingPage() {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Buddie AI",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: [
      { "@type": "Offer", name: "Buddy", price: "0", priceCurrency: "USD" },
      { "@type": "Offer", name: "Pro", price: "29", priceCurrency: "USD" },
      { "@type": "Offer", name: "Agency", price: "99", priceCurrency: "USD" },
    ],
    url: "https://buddieai.com/pricing",
  };

  const { status } = useSession();
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: "pro" | "agency") {
    setError(null);
    const res = await fetch("/api/lemonsqueezy/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: plan }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      setError(data.error || "Could not start Lemon Squeezy checkout");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddy AI · emotional intelligence</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Pricing that scales with feeling</h1>
      <p className="mt-4 max-w-2xl text-slate-300">
        Humanize your AI for end users with the Buddy embed — then prove it in the dashboard with sentiment, mood
        timelines, and emotional intelligence analytics. Lemon Squeezy powers secure subscriptions for all paid plans.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <article className="glass-panel p-6 ring-1 ring-indigo-500/25">
          <h2 className="text-xl font-semibold text-white">Buddy</h2>
          <p className="mt-2 text-sm text-slate-300">
            Your on-ramp to emotional intelligence: one Buddy, basic face, and a dashboard mood log so you can
            humanize your AI without guessing.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-1.5 text-sm text-slate-400">
            <li>1 Buddy (license)</li>
            <li>Basic face · up to 10 mood shifts per day on the free telemetry tier</li>
            <li>Dashboard: last 7 days of mood log</li>
            <li>Watermark on widget</li>
          </ul>
          <p className="mt-5 text-4xl font-bold text-white">$0</p>
          <p className="text-xs text-slate-400">Forever</p>
          <Link
            href="/register"
            className="mt-6 inline-flex rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Start with Buddy
          </Link>
        </article>

        <article className="glass-panel p-6">
          <h2 className="text-xl font-semibold text-white">Pro</h2>
          <p className="mt-2 text-sm text-slate-300">
            Full emotional intelligence analytics: unlimited mood telemetry, timelines, sentiment score, and top words —
            the business layer that makes your Buddy measurable.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-1.5 text-sm text-slate-400">
            <li>Unlimited moods streamed to analytics</li>
            <li>Full analytics: timeline, sentiment score, top words</li>
            <li>Custom face colours</li>
            <li>Remove watermark</li>
            <li>Priority support</li>
          </ul>
          <p className="mt-5 text-4xl font-bold text-white">$29</p>
          <p className="text-xs text-slate-400">per month</p>
          <button
            disabled={status !== "authenticated"}
            onClick={() => void subscribe("pro")}
            className="mt-4 w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 disabled:opacity-50"
          >
            Subscribe
          </button>
        </article>

        <article className="glass-panel p-6">
          <h2 className="text-xl font-semibold text-white">Agency</h2>
          <p className="mt-2 text-sm text-slate-300">
            Everything in Pro for teams that ship AI at scale — collaboration, API control, white-label, and CSV
            exports so emotional intelligence becomes a deliverable.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-1.5 text-sm text-slate-400">
            <li>Everything in Pro</li>
            <li>Team collaboration (shared mood across devices)</li>
            <li>Custom face image upload</li>
            <li>API for external mood control</li>
            <li>White-label</li>
            <li>Dedicated success manager</li>
          </ul>
          <p className="mt-5 text-4xl font-bold text-white">$99</p>
          <p className="text-xs text-slate-400">per month</p>
          <button
            disabled={status !== "authenticated"}
            onClick={() => void subscribe("agency")}
            className="mt-4 w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 disabled:opacity-50"
          >
            Subscribe
          </button>
        </article>
      </div>

      {status !== "authenticated" ? (
        <p className="mt-4 text-sm text-amber-300">Login first to unlock Lemon Squeezy checkout.</p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <section className="mt-16 glass-panel p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-white">FAQ</h2>
        <p className="mt-4 text-sm font-medium text-indigo-200">Why is this different from a chatbot smiley face?</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Because we tell you what your users are feeling at scale. That&apos;s the difference between a toy and a
          business tool.
        </p>
      </section>
    </main>
  );
}
