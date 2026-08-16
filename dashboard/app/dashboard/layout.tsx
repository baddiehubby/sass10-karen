import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { UniverseShell } from "@/components/universe-shell";
import { DashboardMinimalNav } from "@/components/dashboard-minimal-nav";
import { IntelligenceWarmup } from "@/components/intelligence-warmup";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-buddie-display",
  display: "swap",
});

const body = Outfit({
  subsets: ["latin"],
  variable: "--font-buddie-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Home",
  description: "Buddie's home — presence, rituals, and soft rooms.",
  alternates: { canonical: "/dashboard" },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`buddie-home min-h-screen ${display.variable} ${body.variable}`}
      style={{ background: "#0b0a09", fontFamily: "var(--font-buddie-body), sans-serif" }}
    >
      <DashboardMinimalNav />
      <IntelligenceWarmup />
      <UniverseShell>{children}</UniverseShell>
    </div>
  );
}
