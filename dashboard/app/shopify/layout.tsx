import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shopify",
  description: "Buddy AI – The Emotional Intelligence Layer for AI Chat. Add Buddy to your Shopify theme.",
};

export default function ShopifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
