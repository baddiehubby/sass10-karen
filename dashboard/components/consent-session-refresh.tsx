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
        await update();
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
