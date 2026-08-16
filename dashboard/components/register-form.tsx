"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { safeAppPath } from "@/lib/safe-redirect";

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as {
      error?: string;
      fieldErrors?: Record<string, string[]>;
    };
    if (typeof data.error === "string" && data.error) return data.error;
    const emailErr = data.fieldErrors?.email?.[0];
    if (emailErr) return emailErr;
    const passwordErr = data.fieldErrors?.password?.[0];
    if (passwordErr) return passwordErr;
  } catch {
    /* ignore */
  }
  return "Registration failed. Please try again.";
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = safeAppPath(searchParams.get("returnUrl"), "/pricing");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, email, password }),
      });

      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: returnUrl,
      });

      if (signInResult?.error) {
        setError("Account created, but automatic sign-in failed. Please sign in on the login page.");
        return;
      }

      router.push(returnUrl);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <div className="glass-panel p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Create account</h1>
        <p className="mt-2 text-sm text-slate-300">
          Create your account, then continue to secure checkout. Your Buddy license is issued after payment.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          <Link href="/login" className="text-indigo-300 underline hover:text-indigo-200">
            Already have a license? Sign in
          </Link>
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            placeholder="Password (min 10)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-900/25 hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Continue to checkout"}
          </button>
          <Link href="/pricing" className="block text-center text-sm text-slate-400 hover:text-slate-200">
            Back to pricing
          </Link>
        </form>
      </div>
    </main>
  );
}
