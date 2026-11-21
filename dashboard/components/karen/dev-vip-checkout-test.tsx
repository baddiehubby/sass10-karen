"use client";

/**
 * TEMPORARY QA tool — "Test VIP Checkout".
 * Rendered by app/karen/page.tsx ONLY when NODE_ENV === "development"
 * (KAREN_DEV below is a second guard so the bundler can drop it in production).
 *
 * Collapsed behind a small "$" tab. Expanded it:
 *   1. shows live billing state (signed in? Lemon env present? DB isPremium?)
 *   2. "Test VIP Checkout" → real createKarenVipCheckout() → opens the Lemon URL
 *   3. polls Prisma until the webhook flips User.isPremium → then reloads the app
 *
 * It cannot complete a payment for you: finish the Lemon TEST-MODE checkout with
 * card 4242 4242 4242 4242, and the webhook must reach this machine (tunnel).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  createKarenVipCheckout,
  getKarenDevBillingStatus,
  type KarenDevBillingStatus,
} from "@/app/karen/actions";
import { karenDevLog, karenDevWarn, KAREN_DEV } from "@/lib/karen/dev-log";

const POLL_MS = 3000;
const POLL_MAX_MS = 10 * 60 * 1000;

type Phase = "idle" | "starting" | "waiting" | "paid" | "error";

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "text-emerald-300" : "text-rose-300"}>
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

export function DevVipCheckoutTest() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<KarenDevBillingStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const pollRef = useRef<number>(0);

  const stopPoll = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = 0;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await getKarenDevBillingStatus();
      setStatus(s);
      return s;
    } catch (err) {
      setMessage(`status failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => stopPoll, [stopPoll]);

  const startPolling = useCallback(() => {
    stopPoll();
    const startedAt = Date.now();
    pollRef.current = window.setInterval(() => {
      void (async () => {
        const s = await refresh();
        if (s?.isPremiumDb) {
          stopPoll();
          setPhase("paid");
          setMessage("Webhook landed: User.isPremium = true. Reloading…");
          karenDevLog("VIP QA: webhook flipped isPremium → true, reloading");
          window.setTimeout(() => window.location.reload(), 1500);
        } else if (Date.now() - startedAt > POLL_MAX_MS) {
          stopPoll();
          setPhase("error");
          setMessage(
            "Timed out (10 min) — isPremium never flipped. Webhook not delivered? Check the tunnel + Lemon webhook log.",
          );
          karenDevWarn("VIP QA: timed out waiting for the Lemon webhook");
        }
      })();
    }, POLL_MS);
  }, [refresh, stopPoll]);

  const runCheckout = useCallback(async () => {
    setPhase("starting");
    setMessage("");
    const s = await refresh();
    if (s?.isPremiumDb) {
      setPhase("paid");
      setMessage("DB already has isPremium = true for this account (nothing to buy).");
      return;
    }
    try {
      const res = await createKarenVipCheckout();
      if (!res.ok) {
        setPhase("error");
        setMessage(res.needsAuth ? "Sign in first (checkout needs a real user)." : res.error);
        karenDevWarn("VIP QA: checkout not created", res);
        return;
      }
      karenDevLog("VIP QA: checkout created, opening Lemon test checkout");
      window.open(res.url, "_blank", "noopener,noreferrer");
      setPhase("waiting");
      setMessage("Checkout opened. Pay with 4242 4242 4242 4242, then wait for the webhook…");
      startPolling();
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }, [refresh, startPolling]);

  if (!KAREN_DEV) return null;

  return (
    <div
      data-testid="dev-vip-checkout-test"
      className="pointer-events-auto fixed bottom-3 right-3 z-[70] flex flex-col items-end gap-1"
    >
      {open ? (
        <div className="w-[260px] rounded-md border border-fuchsia-400/60 bg-black/90 p-2 font-mono text-[10px] text-fuchsia-100/90 shadow-lg backdrop-blur">
          <button
            type="button"
            data-testid="dev-vip-checkout-run"
            disabled={phase === "starting" || phase === "waiting"}
            onClick={() => void runCheckout()}
            className="mb-2 w-full rounded border border-fuchsia-400/70 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-fuchsia-200 disabled:opacity-50"
          >
            Test VIP Checkout
          </button>

          <div data-testid="dev-vip-checkout-status" className="space-y-0.5">
            {status ? (
              <>
                <div>
                  <Flag ok={status.signedIn} label={status.signedIn ? `signed in …${status.userIdTail}` : "signed out"} />
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <Flag ok={status.config.apiKey} label="API key" />
                  <Flag ok={status.config.storeId} label="store" />
                  <Flag ok={status.config.vipVariant} label="variant" />
                  <Flag ok={status.config.webhookSecret} label="webhook secret" />
                </div>
                <div>
                  DB isPremium:{" "}
                  <b data-testid="dev-vip-db-premium">
                    {status.isPremiumDb === null ? "n/a" : String(status.isPremiumDb)}
                  </b>
                </div>
                {status.dbError ? <div className="text-rose-300">DB: {status.dbError}</div> : null}
                {status.paywallBypassed ? (
                  <div className="text-amber-300">
                    Dev VIP bypass is ON — the paywall is hidden. Set
                    NEXT_PUBLIC_KAREN_REAL_PAYWALL=true and restart to see it.
                  </div>
                ) : (
                  <div className="text-emerald-300">Real paywall active (bypass off).</div>
                )}
              </>
            ) : (
              <div>loading…</div>
            )}
            {message ? (
              <div
                data-testid="dev-vip-checkout-message"
                className={phase === "error" ? "text-rose-300" : "text-fuchsia-100"}
              >
                {message}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        aria-label="Toggle VIP checkout test tool"
        data-testid="dev-vip-checkout-toggle"
        onClick={() => setOpen((v) => !v)}
        className="h-6 w-6 rounded-full border border-fuchsia-400/50 bg-black/70 text-[11px] font-bold text-fuchsia-300 opacity-40 hover:opacity-100"
      >
        $
      </button>
    </div>
  );
}
