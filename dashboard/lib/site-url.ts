import { isSafeRelativePath, safeAppPath } from "@/lib/safe-redirect";

/** Canonical production origin — always www (Google OAuth redirect must match exactly). */
export const PRODUCTION_SITE_URL = "https://www.buddieai.com";

const VERCEL_PREVIEW_HOST_RE = /\.vercel\.app$/i;
const BUDDIE_HOST_RE = /^(www\.)?buddieai\.com$/i;

const LOCALHOST_URL_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i;

function trimOrigin(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/**
 * Public app origin for API bases, widget embeds, and Lemon redirect URLs.
 * Prefer NEXT_PUBLIC_APP_URL, then NEXT_PUBLIC_SITE_URL, then canonical auth URL.
 * Production never returns localhost or non-www buddieai hosts.
 */
export function getAppBaseUrl(): string {
  if (process.env.NODE_ENV === "production") {
    const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (app && !LOCALHOST_URL_RE.test(app)) return normalizeProductionOrigin(app);
    const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (site && !LOCALHOST_URL_RE.test(site)) return normalizeProductionOrigin(site);
    return PRODUCTION_SITE_URL;
  }
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (app) return trimOrigin(app);
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return trimOrigin(site);
  return getCanonicalSiteUrl();
}

/** True when running a local dev server (next dev). */
export function isLocalDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}

function normalizeProductionOrigin(url: string): string {
  try {
    const parsed = new URL(url.trim());
    if (VERCEL_PREVIEW_HOST_RE.test(parsed.hostname)) {
      return PRODUCTION_SITE_URL;
    }
    if (BUDDIE_HOST_RE.test(parsed.hostname)) {
      return PRODUCTION_SITE_URL;
    }
    if (parsed.hostname === "www.sachapandit.com" || parsed.hostname === "sachapandit.com") {
      return "https://www.sachapandit.com";
    }
  } catch {
    /* ignore */
  }
  return PRODUCTION_SITE_URL;
}

/**
 * Canonical origin for OAuth and redirects.
 * Production always resolves to https://www.buddieai.com unless NEXTAUTH_URL is localhost.
 */
export function getCanonicalSiteUrl(): string {
  if (process.env.NODE_ENV === "production") {
    const explicit = process.env.NEXTAUTH_URL?.trim();
    if (explicit && LOCALHOST_URL_RE.test(explicit)) {
      return explicit.replace(/\/$/, "");
    }
    if (explicit) {
      return normalizeProductionOrigin(explicit);
    }
    return PRODUCTION_SITE_URL;
  }
  const fromEnv = process.env.NEXTAUTH_URL?.trim();
  return (fromEnv || "http://localhost:3000").replace(/\/$/, "");
}

/** Pin NextAuth / Auth.js to the canonical URL before handlers run. */
export function pinNextAuthUrl(): void {
  const canonical = getCanonicalSiteUrl();
  process.env.NEXTAUTH_URL = canonical;
  // Auth.js v5-style alias (harmless on NextAuth v4 if unused)
  process.env.AUTH_URL = canonical;
  // NextAuth v4 has no trustHost in AuthOptions; set env so the handler trusts forwarded host
  // only after NEXTAUTH_URL is already pinned to the canonical origin.
  process.env.AUTH_TRUST_HOST = "true";
}

export function getGoogleOAuthRedirectUri(): string {
  return `${getCanonicalSiteUrl()}/api/auth/callback/google`;
}

/** Post-login destination; always absolute on production. */
export function resolvePostAuthCallbackUrl(relativeOrAbsolute: string | null | undefined): string {
  const base = getCanonicalSiteUrl();
  const fallback = `${base}/dashboard`;

  if (!relativeOrAbsolute?.trim()) return fallback;

  const raw = relativeOrAbsolute.trim();
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const target = new URL(raw);
      const allowed = new URL(base);
      if (target.origin === allowed.origin && isSafeRelativePath(target.pathname + target.search + target.hash)) {
        return `${allowed.origin}${target.pathname}${target.search}${target.hash}`;
      }
    } catch {
      /* invalid URL */
    }
    return fallback;
  }

  const path = safeAppPath(raw, "/dashboard");
  return `${base}${path}`;
}

/**
 * Client-side sign-in callbackUrl (used in login-card).
 * Production builds return an absolute canonical URL.
 */
export function getClientSignInCallbackUrl(relativeFromQuery: string | null): string {
  const path = safeAppPath(relativeFromQuery, "/dashboard");

  if (process.env.NODE_ENV !== "production") {
    return path;
  }

  const publicBase =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";
  if (publicBase && LOCALHOST_URL_RE.test(publicBase)) {
    return path;
  }

  return `${PRODUCTION_SITE_URL}${path}`;
}

/** Client-safe app origin (uses public env vars, then production canonical URL). */
export function getPublicAppBaseUrl(): string {
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (app) return trimOrigin(app);
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return trimOrigin(site);
  if (process.env.NODE_ENV === "production") return PRODUCTION_SITE_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

export function logAuthUrlDebug(context: string): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log(`[auth:${context}] NEXTAUTH_URL=${process.env.NEXTAUTH_URL}`);
  console.log(`[auth:${context}] Google redirect_uri=${getGoogleOAuthRedirectUri()}`);
}
