"use client";

import confetti from "canvas-confetti";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

export function DashboardCelebration() {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("celebrate") !== "1") return;
    confetti({ particleCount: 180, spread: 95, origin: { y: 0.7 } });
    toast.success("Welcome to your luxury companion cockpit");
  }, [params]);
  return null;
}
