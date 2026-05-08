import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register",
  description: "Create your Buddie AI account and launch emotional intelligence analytics in minutes.",
  alternates: { canonical: "/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
