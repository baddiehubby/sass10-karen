"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { CinematicOrb, getTimeTheme, TIME_THEME_COLORS } from "@/components/cinematic-orb";
import { getClientSignInCallbackUrl } from "@/lib/site-url";

type LoginCardProps = {
  nextAuthUrl: string;
};

export function LoginCard({ nextAuthUrl }: LoginCardProps) {
  const searchParams = useSearchParams();
  const callbackUrl = getClientSignInCallbackUrl(searchParams.get("callbackUrl"));
  const theme = getTimeTheme();
  const colors = TIME_THEME_COLORS[theme];
  const nextAuthConfigured = Boolean(nextAuthUrl);

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16"
      style={{
        background: `#0a0a1a radial-gradient(ellipse 70% 50% at 50% 35%, ${colors.glow} 0%, transparent 65%)`,
      }}
    >
      <CinematicOrb theme={theme} height="min(42vh, 280px)" breathing />
      <p className="mt-8 max-w-sm text-center text-sm font-light tracking-wide text-white/60">
        Continue with Google to keep your orb alive.
      </p>

      {!nextAuthConfigured ? (
        <p className="mt-4 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          Configuration missing — check NEXTAUTH_URL
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl })}
        className="mt-8 w-full max-w-xs rounded-full border border-white/15 bg-white/8 px-6 py-3.5 text-sm font-medium text-white/90 backdrop-blur-sm transition hover:border-white/30 hover:bg-white/12"
      >
        Continue with Google
      </button>

      <Link href="/about" className="mt-10 text-xs text-white/30 transition hover:text-white/55">
        Learn more
      </Link>
    </main>
  );
}
