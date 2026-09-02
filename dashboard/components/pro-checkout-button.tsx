"use client";

import { useState } from "react";
import type { PaidCheckoutTier } from "@/lib/pricing-plans";

type ProCheckoutButtonProps = {
  tier?: PaidCheckoutTier;
  label?: string;
  className?: string;
};

export function ProCheckoutButton({
  tier = "pro",
  label = "Start Pro",
  className = "buddie-cta inline-flex min-h-12 items-center justify-center px-8 disabled:opacity-50",
}: ProCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lemonsqueezy/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, trial: false }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      // #region agent log
      fetch("http://127.0.0.1:7611/ingest/87ee683e-41c7-4485-9b1b-9c00188d4aac", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f590a1" },
        body: JSON.stringify({
          sessionId: "f590a1",
          hypothesisId: "E",
          location: "pro-checkout-button.tsx:checkout",
          message: "dashboard pro checkout",
          data: { tier, ok: res.ok, status: res.status, hasUrl: Boolean(data.url), error: data.error ?? null },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      if (!res.ok || !data.url) {
        setError(data.error || "Could not start checkout. Try again from Pricing.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" className={className} disabled={loading} onClick={() => void startCheckout()}>
        {loading ? "Opening checkout…" : label}
      </button>
      {error ? <p className="text-xs text-rose-300/90">{error}</p> : null}
    </div>
  );
}
