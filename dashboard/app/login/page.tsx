import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginCard } from "@/components/login-card";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import { getTenantFromRequest } from "@/lib/tenant-request";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to continue with your companion dashboard.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  const nextAuthUrl = getCanonicalSiteUrl();
  const tenant = getTenantFromRequest();
  const loginHint =
    tenant === "sachapandit"
      ? "Continue with Google to meet your Pandit."
      : "Continue with Google to keep your orb alive.";
  return (
    <>
      <p className="sr-only">{loginHint}</p>
      <Suspense fallback={<main className="mx-auto max-w-md px-6 py-12 text-slate-400">Loading…</main>}>
        <LoginCard nextAuthUrl={nextAuthUrl} tenant={tenant} />
      </Suspense>
    </>
  );
}
