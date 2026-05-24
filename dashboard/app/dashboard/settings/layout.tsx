import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Customize your Buddy AI companion name and personality.",
  alternates: { canonical: "/dashboard/settings" },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
