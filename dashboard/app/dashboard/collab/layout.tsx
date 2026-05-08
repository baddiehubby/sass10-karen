import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Collaborative mood",
  description: "Agency-tier shared mood sync across devices for Buddie AI embeds.",
  alternates: { canonical: "/dashboard/collab" },
};

export default function CollabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
