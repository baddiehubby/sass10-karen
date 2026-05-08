import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API docs",
  description: "Buddy AI – The Emotional Intelligence Layer for AI Chat. Widget embed and HTTP API reference.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
