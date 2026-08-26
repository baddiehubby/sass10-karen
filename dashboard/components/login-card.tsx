"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { CinematicOrb, getTimeTheme, TIME_THEME_COLORS } from "@/components/cinematic-orb";
import { PrivacyBadge } from "@/components/privacy-badge";
import { getClientSignInCallbackUrl, PRODUCTION_SITE_URL } from "@/lib/site-url";
import { brandingFromHostname, brandingFromTenantSlug } from "@/lib/tenant-brand";
import type { TenantSlug } from "@/lib/tenant";

type LoginCardProps = {
  nextAuthUrl: string;
  tenant?: TenantSlug;
};

export function LoginCard({ nextAuthUrl, tenant }: LoginCardProps) {
  const searchParams = useSearchParams();
  const callbackUrl = getClientSignInCallbackUrl(searchParams.get("callbackUrl"));
  const authError = searchParams.get("error");
  const theme = getTimeTheme();
  const colors = TIME_THEME_COLORS[theme];
  const branding =
    tenant != null
      ? brandingFromTenantSlug(tenant)
      : brandingFromHostname(typeof window !== "undefined" ? window.location.hostname : "");
  const oauthRedirectUri =
    branding.tenant === "sachapandit"
      ? "https://www.sachapandit.com/api/auth/callback/google"
      : `${PRODUCTION_SITE_URL}/api/auth/callback/google`;
  const nextAuthConfigured = Boolean(nextAuthUrl);
  const showOAuthSetupHint =
    authError === "google" ||
    authError === "OAuthSignin" ||
    authError === "OAuthCallback" ||
    authError === "AccessDenied" ||
    authError === "Configuration";

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16"
      style={{
        background: `#0a0a1a radial-gradient(ellipse 70% 50% at 50% 35%, ${colors.glow} 0%, transparent 65%)`,
      }}
    >
      <CinematicOrb theme={theme} height="min(42vh, 280px)" breathing />
      <p className="mt-8 max-w-sm text-center text-sm font-light tracking-wide text-white/60">
        {branding.tenant === "sachapandit"
          ? "Continue with Google to meet your Pandit."
          : "Continue with Google to keep your orb alive."}
      </p>

      {!nextAuthConfigured ? (
        <p className="mt-4 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          Configuration missing — check NEXTAUTH_URL
        </p>
      ) : null}

      {showOAuthSetupHint ? (
        <p className="mt-4 max-w-sm rounded-lg border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-center text-xs leading-relaxed text-rose-100/90">
          Google sign-in failed. Confirm cookies are allowed for this site, then retry. In Google
          Cloud Console → Credentials → your <strong>Web client</strong>, the Authorized redirect
          URI must be exactly:{" "}
          <code className="break-all text-rose-50">{oauthRedirectUri}</code>
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl })}
        className="premium-btn-glow mt-8 w-full max-w-xs rounded-full border border-white/15 bg-white/8 px-6 py-3.5 text-sm font-medium text-white/90 backdrop-blur-sm transition hover:border-white/30 hover:bg-white/12"
      >
        {branding.tenant === "sachapandit" ? "Continue with Google to meet your Pandit" : "Continue with Google"}
      </button>

      <PrivacyBadge variant="login" className="mt-4" />

      <Link href="/about" className="mt-10 text-xs text-white/30 transition hover:text-white/55">
        Learn more
      </Link>
    </main>
  );
}
