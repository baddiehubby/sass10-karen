"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

type PaidTier = "pro" | "agency";

export default function PricingPage() {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Buddie AI",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: [
      { "@type": "Offer", name: "Buddy Free", price: "0", priceCurrency: "USD" },
      { "@type": "Offer", name: "Buddy Pro", price: "19", priceCurrency: "USD" },
      { "@type": "Offer", name: "Buddy Agency", price: "99", priceCurrency: "USD" },
    ],
    url: "https://buddieai.com/pricing",
  };

  const { status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<PaidTier | null>(null);

  const startCheckout = useCallback(
    async (tier: PaidTier) => {
      setError(null);
      setLoadingKey(tier);

      try {
        if (status !== "authenticated") {
          const returnParams = new URLSearchParams({ checkout: tier });
          window.location.href = `/login?callbackUrl=${encodeURIComponent(`/pricing?${returnParams}`)}`;
          return;
        }

        const res = await fetch("/api/lemonsqueezy/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier, trial: false }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          setError(data.error || "Could not start Lemon Squeezy checkout");
          return;
        }
        window.location.href = data.url;
      } finally {
        setLoadingKey(null);
      }
    },
    [status],
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout") as PaidTier | null;
    if (checkout === "pro" || checkout === "agency") {
      void startCheckout(checkout);
    }
  }, [status, startCheckout]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddy AI · emotional intelligence</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Free forever. Upgrade when ready.</h1>
      <p className="mt-4 max-w-2xl text-slate-300">
        Your Buddy orb is free for life — basic moods, basic memory, and a small watermark. Pro and Agency unlock
        analytics, custom themes, white-label, and compliance tools. No trial clock. No pressure.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <article className="glass-panel p-6 ring-1 ring-slate-500/20">
          <h2 className="text-xl font-semibold text-white">Buddy Free</h2>
          <p className="mt-2 text-sm text-slate-300">
            Your emotional companion forever. Basic moods, basic memory, watermark on the orb.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-1.5 text-sm text-slate-400">
            <li>Basic mood detection</li>
            <li>Basic memory</li>
            <li>Watermark on embed</li>
            <li>Free forever — not a trial</li>
          </ul>
          <p className="mt-5 text-4xl font-bold text-white">$0</p>
          <p className="text-xs text-slate-400">forever</p>
          <Link
            href="/login"
            className="mt-6 block w-full rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-center text-sm font-medium text-slate-100 hover:bg-white/10"
          >
            Get started free
          </Link>
        </article>

        <article className="glass-panel p-6 ring-1 ring-indigo-500/30">
          <h2 className="text-xl font-semibold text-white">Buddy Pro</h2>
          <p className="mt-2 text-sm text-slate-300">
            Advanced analytics, custom themes, no watermark, and priority support.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-1.5 text-sm text-slate-400">
            <li>Everything in Free</li>
            <li>Advanced analytics & mood timeline</li>
            <li>Custom themes — no watermark</li>
            <li>Priority support</li>
          </ul>
          <p className="mt-5 text-4xl font-bold text-white">$19</p>
          <p className="text-xs text-slate-400">per month</p>
          <button
            disabled={loadingKey !== null}
            onClick={() => void startCheckout("pro")}
            className="mt-6 w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 disabled:opacity-50"
          >
            {loadingKey === "pro" ? "Redirecting…" : "Upgrade to Pro"}
          </button>
        </article>

        <article className="glass-panel p-6 ring-1 ring-violet-500/30">
          <h2 className="text-xl font-semibold text-white">Buddy Agency</h2>
          <p className="mt-2 text-sm text-slate-300">
            White-label, compliance reports, family mode, and team seats for client work.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-1.5 text-sm text-slate-400">
            <li>Everything in Pro</li>
            <li>White-label widget</li>
            <li>Compliance reports</li>
            <li>Family mode & team seats</li>
          </ul>
          <p className="mt-5 text-4xl font-bold text-white">$99</p>
          <p className="text-xs text-slate-400">per month</p>
          <button
            disabled={loadingKey !== null}
            onClick={() => void startCheckout("agency")}
            className="mt-6 w-full rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 hover:bg-violet-500 disabled:opacity-50"
          >
            {loadingKey === "agency" ? "Redirecting…" : "Upgrade to Agency"}
          </button>
        </article>
      </div>

      <p className="mt-6 text-sm text-slate-400">
        {status === "authenticated" ? (
          <>Signed in — your free Buddy is already active. Upgrades open Lemon Squeezy checkout.</>
        ) : (
          <>
            Sign in with Google to get your free Buddy instantly.{" "}
            <Link href="/login" className="text-indigo-300 underline">
              Continue with Google
            </Link>
          </>
        )}
      </p>
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <section className="mt-16 glass-panel p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-white">FAQ</h2>
        <p className="mt-4 text-sm font-medium text-indigo-200">Is the free plan really free forever?</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Yes. Buddy Free is a perpetual plan — not a trial. You get a working orb with basic moods and memory. Upgrade
          only when you want analytics, custom themes, or agency tools.
        </p>
        <p className="mt-4 text-sm font-medium text-indigo-200">How do I manage or cancel a paid subscription?</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Use the Lemon Squeezy customer portal in Settings after checkout. If you cancel, your license reverts to Buddy
          Free — your orb stays alive.
        </p>
      </section>
    </main>
  );
}
