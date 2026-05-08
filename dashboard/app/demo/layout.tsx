import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Demo",
  description: "Try Buddie AI live and watch the companion react while emotional data streams to analytics.",
  alternates: { canonical: "/demo" },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
