import { Suspense } from "react";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { LoginCard } from "@/components/login-card";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import { brandingFromHostname } from "@/lib/tenant-brand";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to continue with your companion dashboard.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  const nextAuthUrl = getCanonicalSiteUrl();
  const branding = brandingFromHostname(headers().get("host"));
  return (
    <>
      <p className="sr-only">Continue with Google to meet your {branding.shortName}.</p>
      <Suspense fallback={<main className="mx-auto max-w-md px-6 py-12 text-slate-400">Loading…</main>}>
        <LoginCard nextAuthUrl={nextAuthUrl} />
      </Suspense>
    </>
  );
}
