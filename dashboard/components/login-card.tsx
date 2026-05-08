"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginCardProps = {
  nextAuthUrl: string;
};

export function LoginCard({ nextAuthUrl }: LoginCardProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nextAuthConfigured = Boolean(nextAuthUrl);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);

    if (result?.error) {
      setError("Invalid credentials.");
      return;
    }
    router.push("/dashboard");
  }

  async function onGoogleSignIn() {
    setError(null);
    const callbackFromQuery =
      typeof window !== "undefined"
        ? new URL(window.location.href).searchParams.get("callbackUrl") || "/dashboard"
        : "/dashboard";
    console.info("[auth] Continue with Google redirect", {
      nextAuthUrl: nextAuthUrl || "missing",
      callbackUrl: callbackFromQuery,
    });
    await signIn("google", { callbackUrl: callbackFromQuery });
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <div className="glass-panel p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Login</h1>
        <p className="mt-2 text-sm text-slate-300">Continue with your Google account or use email and password.</p>

        {!nextAuthConfigured ? (
          <p className="mt-4 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            Configuration missing - check NEXTAUTH_URL
          </p>
        ) : null}

        <button
          type="button"
          onClick={onGoogleSignIn}
          className="mt-5 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15"
        >
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-900/25 hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
