import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onboarding",
  description: "Name your Buddy, pick personality, and copy your embed code to launch Buddie AI.",
  alternates: { canonical: "/onboarding" },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
