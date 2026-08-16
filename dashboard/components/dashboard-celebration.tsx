"use client";

import confetti from "canvas-confetti";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

async function softUnlockAfterCheckout(tier: string | null): Promise<"unlocked" | "pending" | "error"> {
  try {
    await fetch("/api/billing/sync", { method: "POST", cache: "no-store" });
  } catch {
    /* Lemon may be slow — keep trying status */
  }

  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch("/api/billing/status", { cache: "no-store" });
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      const data = (await res.json()) as {
        entitlements?: { requiresSubscription?: boolean };
        subscriptionLabel?: string;
      };
      if (data.entitlements && data.entitlements.requiresSubscription === false) {
        return "unlocked";
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
    void tier;
  }
  return "pending";
}

export function DashboardCelebration() {
  const params = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const payment = params.get("payment");
    const legacyLemon = params.get("lemonsqueezy") === "success";
    const celebrate = params.get("celebrate") === "1";
    const tier = params.get("tier");

    if (payment === "cancelled") {
      handled.current = true;
      toast("Checkout was not completed. Your account is still here.", { icon: "ℹ️" });
      router.replace("/dashboard", { scroll: false });
      return;
    }

    const paymentSuccess = payment === "success" || legacyLemon;
    if (!paymentSuccess && !celebrate) return;

    handled.current = true;

    const prefersReduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReduce) {
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 } });
    }

    const tierLabel =
      tier === "starter"
        ? "Starter"
        : tier === "pro"
          ? "Pro"
          : tier === "premium" || tier === "agency"
            ? "Premium"
            : null;

    if (!paymentSuccess) {
      toast.success("Welcome back to Buddie.");
      router.replace("/dashboard", { scroll: false });
      return;
    }

    toast.success(
      tierLabel
        ? `Checkout received for ${tierLabel}. Confirming with Buddie’s servers…`
        : "Checkout received. Confirming with Buddie’s servers…",
    );

    void softUnlockAfterCheckout(tier).then((state) => {
      if (state === "unlocked") {
        toast.success("Premium is active. Welcome deeper in.");
      } else {
        toast(
          "Payment is processing. Premium unlocks as soon as Lemon confirms — refresh anytime.",
          { icon: "⏳" },
        );
      }
      router.replace("/dashboard", { scroll: false });
      router.refresh();
    });
  }, [params, router]);

  return null;
}
