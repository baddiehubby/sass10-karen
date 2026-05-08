import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buddy Challenge",
  description: "Buddy AI – The Emotional Intelligence Layer for AI Chat. Take the 7-day Buddy Challenge.",
};

export default function ChallengeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
