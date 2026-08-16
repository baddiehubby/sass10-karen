import type { Metadata } from "next";
import { IntelligenceWarmup } from "@/components/intelligence-warmup";

export const metadata: Metadata = {
  title: "Meet Buddie",
  description: "Meet your companion — orb, presence, and a soft beginning.",
  alternates: { canonical: "/onboarding" },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="buddie-home min-h-[100dvh] bg-[#0b0a09] text-[#f4efe6]">
      {/* Idle-only optional intelligence warm-up — never blocks orb / steps */}
      <IntelligenceWarmup />
      {children}
    </div>
  );
}
