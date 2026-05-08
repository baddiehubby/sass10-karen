import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buddy theme",
  description: "Customize orb gradients, presets, and widget styling for your Buddie AI license.",
  alternates: { canonical: "/dashboard/theme" },
};

export default function ThemeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
