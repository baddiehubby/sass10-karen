import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Emotional wellness",
  description: "Buddy AI – The Emotional Intelligence Layer for AI Chat. Weekly playful wellness PDF for your Buddy.",
};

export default function EmotionalWellnessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
