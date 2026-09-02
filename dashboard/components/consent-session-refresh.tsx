"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * DB has consent but JWT is stale — refresh session before entering dashboard
 * so middleware does not bounce /consent ↔ /dashboard.
 */
export function ConsentSessionRefresh() {
  const { update } = useSession();
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const updated = await update();
        // #region agent log
        fetch("http://127.0.0.1:7611/ingest/87ee683e-41c7-4485-9b1b-9c00188d4aac", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f590a1" },
          body: JSON.stringify({
            sessionId: "f590a1",
            hypothesisId: "A",
            location: "consent-session-refresh.tsx:update",
            message: "stale JWT refresh path",
            data: {
              eidataConsentCompleted: Boolean(
                (updated?.user as { eidataConsentCompleted?: boolean } | undefined)?.eidataConsentCompleted,
              ),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        if (cancelled) return;
        router.replace("/dashboard");
        router.refresh();
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [update, router]);

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-white/70">Could not refresh your session.</p>
        <button
          type="button"
          className="mt-4 rounded-full border border-white/20 px-5 py-2 text-sm text-white/85 hover:bg-white/5"
          onClick={() => window.location.assign("/login?callbackUrl=/consent")}
        >
          Sign in again
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-white/55">Saving your privacy choices…</p>
    </div>
  );
}
