"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  isPaidCheckoutTier,
  PRICING_TIER_LIST,
  type PaidCheckoutTier,
} from "@/lib/pricing-plans";

function PricingContent() {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Buddy AI",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    offers: PRICING_TIER_LIST.map((tier) => ({
      "@type": "Offer",
      name: tier.name,
      price: String(tier.priceUsd),
      priceCurrency: "USD",
    })),
    url: "https://buddieai.com/pricing",
  };

  const { status } = useSession();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<PaidCheckoutTier | null>(null);

  const startCheckout = useCallback(
    async (tier: PaidCheckoutTier) => {
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error. Please try again.");
      } finally {
        setLoadingKey(null);
      }
    },
    [status],
  );

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "cancelled") {
      setInfo("Checkout cancelled. Your account is still here — subscribe whenever you're ready.");
      setError(null);
      return;
    }
    if (status !== "authenticated") return;
    if (checkout && isPaidCheckoutTier(checkout)) {
      void startCheckout(checkout);
    }
  }, [status, startCheckout, searchParams]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddy AI · premium companion</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        Your living AI companion. From $20/month.
      </h1>
      <p className="mt-4 max-w-2xl text-slate-300">
        Buddy talks with you, reacts to your vibe, remembers meaningful moments, and grows visually with your everyday
        life. One Orb. Three rooms. A companion worth opening every day.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PRICING_TIER_LIST.map((tier) => {
          const featured = tier.id === "pro";
          return (
            <article
              key={tier.id}
              className={`glass-panel p-6 ${featured ? "ring-1 ring-indigo-500/40" : "ring-1 ring-slate-500/20"}`}
            >
              {featured ? (
                <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-300">Most popular</p>
              ) : null}
              <h2 className="mt-1 text-xl font-semibold text-white">{tier.name}</h2>
              <p className="mt-5 text-4xl font-bold text-white">
                {tier.priceLabel}
                <span className="ml-1 text-base font-normal text-slate-400">{tier.subtitle}</span>
              </p>
              <ul className="mt-4 list-inside list-disc space-y-1.5 text-sm text-slate-400">
                {tier.highlights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <button
                type="button"
                disabled={loadingKey !== null}
                onClick={() => void startCheckout(tier.id)}
                className={`mt-6 w-full rounded-full px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                  featured
                    ? "bg-indigo-600 shadow-lg shadow-indigo-900/30 hover:bg-indigo-500"
                    : "bg-white/10 hover:bg-white/15"
                }`}
              >
                {loadingKey === tier.id ? "Redirecting…" : `Choose ${tier.name}`}
              </button>
            </article>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-slate-400">
        {status === "authenticated" ? (
          <>Signed in — checkout opens Lemon Squeezy securely. Entitlements update from webhook state, not the browser.</>
        ) : (
          <>
            Sign in to subscribe.{" "}
            <Link href="/login" className="text-indigo-300 underline">
              Continue with Google
            </Link>
          </>
        )}
      </p>
      {info ? <p className="mt-4 text-sm text-amber-200/90">{info}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <section className="mt-16 glass-panel p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-white">FAQ</h2>
        <p className="mt-4 text-sm font-medium text-indigo-200">Is Buddy AI a free product?</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          No. Buddy AI is a premium companion starting at $20/month. You can create an account to sign in, then choose a
          plan to unlock the full living experience.
        </p>
        <p className="mt-4 text-sm font-medium text-indigo-200">How do I manage or cancel?</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Use the Lemon Squeezy customer portal in Settings after checkout. Your Orb identity stays with your account.
        </p>
        <p className="mt-4 text-sm font-medium text-indigo-200">Is Buddy a therapist or fortune teller?</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          No. Buddy is an AI companion for everyday life. Mood and Oracle are playful, reflective experiences — not
          medical care or supernatural prediction.
        </p>
      </section>
    </main>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-6 py-14 text-slate-400">Loading pricing…</main>}>
      <PricingContent />
    </Suspense>
  );
}
