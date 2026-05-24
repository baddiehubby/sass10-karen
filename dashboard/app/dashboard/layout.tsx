import type { Metadata } from "next";
import { DashboardMinimalNav } from "@/components/dashboard-minimal-nav";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Buddy's home — mood, moments, and presence.",
  alternates: { canonical: "/dashboard" },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{ background: "#0a0a1a" }}
    >
      <DashboardMinimalNav />
      {children}
    </div>
  );
}
