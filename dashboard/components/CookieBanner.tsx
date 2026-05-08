"use client";

import Script from "next/script";
import { useEffect, useMemo, useState } from "react";

const COOKIE_NAME = "buddie-cookie-consent";
const MAX_AGE = 60 * 60 * 24 * 180;

function getConsent(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setConsent(value: "true" | "false") {
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

export function CookieBanner() {
  const [consent, setConsentState] = useState<"true" | "false" | null>(null);

  useEffect(() => {
    const stored = getConsent();
    if (stored === "true" || stored === "false") {
      setConsentState(stored);
    }
  }, []);

  const analyticsEnabled = consent === "true";
  const analyticsUrl = process.env.NEXT_PUBLIC_ANALYTICS_URL?.trim();
  const analyticsDomain = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN?.trim();

  const shouldLoadAnalytics = useMemo(
    () => Boolean(analyticsEnabled && analyticsUrl && analyticsDomain),
    [analyticsEnabled, analyticsUrl, analyticsDomain],
  );

  return (
    <>
      {shouldLoadAnalytics ? (
        <Script
          id="buddie-analytics"
          defer
          data-domain={analyticsDomain}
          src={analyticsUrl}
          strategy="afterInteractive"
        />
      ) : null}

      {consent == null ? (
        <div className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-3xl rounded-2xl border border-white/10 bg-slate-950/92 p-4 shadow-2xl backdrop-blur-xl">
          <p className="text-sm text-slate-200">
            We use cookies to improve your experience and analyze site usage. By continuing, you agree.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConsent("true");
                setConsentState("true");
              }}
              className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => {
                setConsent("false");
                setConsentState("false");
              }}
              className="rounded-full border border-white/20 px-4 py-2 text-xs text-slate-200 hover:bg-white/10"
            >
              Decline
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
