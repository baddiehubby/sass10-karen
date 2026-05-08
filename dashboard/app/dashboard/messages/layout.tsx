import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages",
  description: "Lifecycle and onboarding messages for your Buddie AI account.",
  alternates: { canonical: "/dashboard/messages" },
};

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
