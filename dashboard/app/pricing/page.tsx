"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

type PaidTier = "starter" | "agency" | "enterprise";

export default function PricingPage() {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Buddie AI",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: [
      { "@type": "Offer", name: "Starter", price: "49", priceCurrency: "USD" },
      { "@type": "Offer", name: "Agency", price: "149", priceCurrency: "USD" },
      { "@type": "Offer", name: "Enterprise", price: "499", priceCurrency: "USD" },
    ],
    url: "https://buddieai.com/pricing",
  };

  const { status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const startCheckout = useCallback(
    async (tier: PaidTier, trial: boolean) => {
      setError(null);
      const loadingId = `${tier}-${trial ? "trial" : "buy"}`;
      setLoadingKey(loadingId);

      try {
        if (status !== "authenticated") {
          const returnParams = new URLSearchParams({ checkout: tier, trial: trial ? "1" : "0" });
          window.location.href = `/register?returnUrl=${encodeURIComponent(`/pricing?${returnParams}`)}`;
          return;
        }

        const res = await fetch("/api/lemonsqueezy/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier, trial }),
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
    const trial = params.get("trial") === "1";
    if (checkout === "starter" || checkout === "agency" || checkout === "enterprise") {
      void startCheckout(checkout, trial);
    }
  }, [status, startCheckout]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddy AI · emotional intelligence</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Premium pricing</h1>
      <p className="mt-4 max-w-2xl text-slate-300">
        Start with a card on file — your 14-day trial begins instantly. After payment, your license is created
        automatically and you land on a live dashboard with embed code and orb preview.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <article className="glass-panel p-6 ring-1 ring-indigo-500/25">
          <h2 className="text-xl font-semibold text-white">Starter</h2>
          <p className="mt-2 text-sm text-slate-300">
            Emotional safety widget for one domain, mood detection, and monthly compliance reports.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-1.5 text-sm text-slate-400">
            <li>1 domain · 5 core moods</li>
            <li>Monthly compliance exports</li>
            <li>Email support</li>
          </ul>
          <p className="mt-5 text-4xl font-bold text-white">$49</p>
          <p className="text-xs text-slate-400">per month</p>
          <div className="mt-6 space-y-2">
            <button
              disabled={loadingKey !== null}
              onClick={() => void startCheckout("starter", true)}
              className="w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 disabled:opacity-50"
            >
              {loadingKey === "starter-trial" ? "Redirecting…" : "Start 14-Day Trial"}
            </button>
            <button
              disabled={loadingKey !== null}
              onClick={() => void startCheckout("starter", false)}
              className="w-full rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/10 disabled:opacity-50"
            >
              {loadingKey === "starter-buy" ? "Redirecting…" : "Buy Now"}
            </button>
          </div>
        </article>

        <article className="glass-panel p-6 ring-1 ring-violet-500/30">
          <h2 className="text-xl font-semibold text-white">Agency</h2>
          <p className="mt-2 text-sm text-slate-300">
            Unlimited domains, white-label widget, real-time alerts, and team seats for client work.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-1.5 text-sm text-slate-400">
            <li>Everything in Starter</li>
            <li>Unlimited domains + API access</li>
            <li>Priority support + SLA</li>
          </ul>
          <p className="mt-5 text-4xl font-bold text-white">$149</p>
          <p className="text-xs text-slate-400">per month</p>
          <button
            disabled={loadingKey !== null}
            onClick={() => void startCheckout("agency", false)}
            className="mt-6 w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 disabled:opacity-50"
          >
            {loadingKey === "agency-buy" ? "Redirecting…" : "Subscribe"}
          </button>
        </article>

        <article className="glass-panel p-6">
          <h2 className="text-xl font-semibold text-white">Enterprise</h2>
          <p className="mt-2 text-sm text-slate-300">
            Custom emotion models, dedicated compliance support, and advanced audit trails.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-1.5 text-sm text-slate-400">
            <li>Everything in Agency</li>
            <li>Custom models + on-prem option</li>
            <li>Quarterly compliance reviews</li>
          </ul>
          <p className="mt-5 text-4xl font-bold text-white">$499</p>
          <p className="text-xs text-slate-400">per month</p>
          <button
            disabled={loadingKey !== null}
            onClick={() => void startCheckout("enterprise", false)}
            className="mt-6 w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 disabled:opacity-50"
          >
            {loadingKey === "enterprise-buy" ? "Redirecting…" : "Subscribe"}
          </button>
        </article>
      </div>

      <p className="mt-6 text-sm text-slate-400">
        {status === "authenticated" ? (
          <>Signed in — checkout opens Lemon Squeezy securely.</>
        ) : (
          <>
            New here? Choose a plan above — we&apos;ll create your account, then send you to checkout.{" "}
            <Link href="/login" className="text-indigo-300 underline">
              Already have a license? Sign in
            </Link>
          </>
        )}
      </p>
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <section className="mt-16 glass-panel p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-white">FAQ</h2>
        <p className="mt-4 text-sm font-medium text-indigo-200">How do I manage or cancel my subscription?</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Use the Lemon Squeezy customer portal link on your dashboard after checkout. Plan changes are applied
          automatically via webhooks — manual API upgrades are disabled.
        </p>
      </section>
    </main>
  );
}
