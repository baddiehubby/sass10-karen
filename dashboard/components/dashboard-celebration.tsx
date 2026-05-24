"use client";

import confetti from "canvas-confetti";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

export function DashboardCelebration() {
  const params = useSearchParams();
  useEffect(() => {
    const paymentSuccess =
      params.get("payment") === "success" ||
      params.get("lemonsqueezy") === "success";
    const celebrate = params.get("celebrate") === "1";
    if (!paymentSuccess && !celebrate) return;

    confetti({ particleCount: 180, spread: 95, origin: { y: 0.7 } });
    toast.success(
      paymentSuccess ? "Your Buddy is alive! Payment successful." : "Welcome to your luxury companion cockpit",
    );
  }, [params]);
  return null;
}
