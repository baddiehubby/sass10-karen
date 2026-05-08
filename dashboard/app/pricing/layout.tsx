import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Buddie AI pricing for Buddy, Pro, and Agency emotional intelligence analytics tiers.",
  alternates: { canonical: "/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
