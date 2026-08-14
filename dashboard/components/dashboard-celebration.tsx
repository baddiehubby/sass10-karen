"use client";

import confetti from "canvas-confetti";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

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
    confetti({ particleCount: 180, spread: 95, origin: { y: 0.7 } });

    const tierLabel =
      tier === "starter"
        ? "Starter"
        : tier === "pro"
          ? "Pro"
          : tier === "premium" || tier === "agency"
            ? "Premium"
            : null;
    toast.success(
      paymentSuccess
        ? tierLabel
          ? `Payment successful — Buddy ${tierLabel} is active.`
          : "Payment successful. Your Buddy is ready."
        : "Welcome back to Buddy.",
    );

    router.replace("/dashboard", { scroll: false });
  }, [params, router]);

  return null;
}
