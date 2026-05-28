/** Canonical site URL for OAuth, redirects, and absolute links. */
export const PRODUCTION_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.buddieai.com";

const LOCALHOST_URL_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i;

function trimOrigin(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/**
 * Public app origin for API bases, widget embeds, and Lemon redirect URLs.
 * Prefer NEXT_PUBLIC_APP_URL, then NEXT_PUBLIC_SITE_URL, then canonical auth URL.
 */
export function getAppBaseUrl(): string {
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

/**
 * Canonical origin for the app. In production, use the configured canonical URL,
 * unless NEXTAUTH_URL explicitly points at localhost (for local OAuth testing).
 */
export function getCanonicalSiteUrl(): string {
  if (process.env.NODE_ENV === "production") {
    const explicit = process.env.NEXTAUTH_URL?.trim();
    if (explicit && LOCALHOST_URL_RE.test(explicit)) {
      return explicit.replace(/\/$/, "");
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
      if (target.origin === allowed.origin) return raw;
    } catch {
      /* invalid URL */
    }
    return fallback;
  }

  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${path}`;
}

/**
 * Client-side sign-in callbackUrl (used in login-card).
 * Production builds return an absolute canonical URL.
 */
export function getClientSignInCallbackUrl(relativeFromQuery: string | null): string {
  const path =
    relativeFromQuery && relativeFromQuery.startsWith("/") ? relativeFromQuery : "/dashboard";

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
