import { PRODUCTION_SITE_URL } from "@/lib/site-url";

/**
 * Build absolute URLs for middleware redirects without trusting client Host headers.
 * Production always uses https://www.buddieai.com.
 */
export function getTrustedOriginForRedirects(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }
  const fromEnv = env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) return fromEnv;
  return "http://localhost:3000";
}

/** Safe login redirect; callbackUrl is pathname-only (never absolute attacker URL). */
export function buildLoginRedirectUrl(
  callbackPathname?: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): URL {
  const origin = getTrustedOriginForRedirects(env);
  const login = new URL("/login", `${origin}/`);
  if (
    callbackPathname &&
    callbackPathname.startsWith("/") &&
    !callbackPathname.startsWith("//") &&
    !callbackPathname.startsWith("/\\") &&
    !/[\r\n\0]/.test(callbackPathname)
  ) {
    login.searchParams.set("callbackUrl", callbackPathname);
  }
  return login;
}

export function buildAppRedirectUrl(
  pathname: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): URL {
  const origin = getTrustedOriginForRedirects(env);
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(path, `${origin}/`);
}
