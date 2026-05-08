import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage your Buddie AI Buddy, licenses, embed snippet, and emotional analytics home.",
  alternates: { canonical: "/dashboard" },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
