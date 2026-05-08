import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Outreach",
  description: "Admin outreach templates and demo-mode email queue for Buddie AI distribution.",
  alternates: { canonical: "/dashboard/outreach" },
};

export default function OutreachLayout({ children }: { children: React.ReactNode }) {
  return children;
}
