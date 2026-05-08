import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Emotional analytics",
  description: "Mood timelines, sentiment gauge, and top joy or concern words from your Buddie AI telemetry.",
  alternates: { canonical: "/dashboard/analytics" },
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
