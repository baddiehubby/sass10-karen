import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = {
  title: "Register",
  description: "Create your Buddie AI account and start secure checkout.",
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-12 text-slate-400">Loading…</main>}>
      <RegisterForm />
    </Suspense>
  );
}
