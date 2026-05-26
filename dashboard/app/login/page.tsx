import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginCard } from "@/components/login-card";
import { getCanonicalSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to Buddie AI to manage your Buddy widget and emotional analytics dashboard.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  const nextAuthUrl = getCanonicalSiteUrl();
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-12 text-slate-400">Loading…</main>}>
      <LoginCard nextAuthUrl={nextAuthUrl} />
    </Suspense>
  );
}
