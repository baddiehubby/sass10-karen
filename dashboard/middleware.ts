import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const middlewareSecret = process.env.NEXTAUTH_SECRET;

/** In-memory fixed-window rate limits (per Edge instance). */
const rateBucket = new Map<string, { count: number; resetAt: number }>();

function pruneBuckets(now: number) {
  if (rateBucket.size < 5000) return;
  for (const [k, v] of rateBucket.entries()) {
    if (now > v.resetAt) rateBucket.delete(k);
  }
}

function allowRate(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  pruneBuckets(now);
  const cur = rateBucket.get(key);
  if (!cur || now > cur.resetAt) {
    rateBucket.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= max) return false;
  cur.count += 1;
  return true;
}

function clientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || req.ip || "unknown";
}

function applySecurityHeaders(res: NextResponse) {
  const h = res.headers;
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("X-XSS-Protection", "1; mode=block");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  h.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
}

function withCorsForWidgetApis(req: NextRequest, res: NextResponse) {
  const p = req.nextUrl.pathname;
  if (p.startsWith("/api/analytics/event") || p.startsWith("/api/licenses/verify") || p.startsWith("/api/security/tamper-attempt")) {
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  return res;
}

/** NextAuth + public integration endpoints (no session JWT required). */
const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/licenses/verify",
  "/api/widget/mood",
  "/api/analytics/event",
  "/api/challenge/report",
  "/api/lemonsqueezy/webhook",
  "/api/dev/widget",
  "/api/security/tamper-attempt",
];

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isStrictAuthRoute(pathname: string) {
  return pathname === "/api/auth/register" || pathname === "/api/auth/login";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = clientIp(req);

  if (pathname.startsWith("/api/")) {
    const authWindow = 60_000;
    const strictKey = `auth:${ip}:${pathname}`;
    const generalKey = `api:${ip}`;

    if (isStrictAuthRoute(pathname)) {
      if (!allowRate(strictKey, 5, authWindow)) {
        const res = NextResponse.json({ error: "Too many requests" }, { status: 429 });
        applySecurityHeaders(res);
        return withCorsForWidgetApis(req, res);
      }
    } else if (pathname.startsWith("/api/auth/")) {
      if (!allowRate(`session:${ip}`, 300, authWindow)) {
        const res = NextResponse.json({ error: "Too many requests" }, { status: 429 });
        applySecurityHeaders(res);
        return withCorsForWidgetApis(req, res);
      }
    } else {
      if (!allowRate(generalKey, 60, authWindow)) {
        const res = NextResponse.json({ error: "Too many requests" }, { status: 429 });
        applySecurityHeaders(res);
        return withCorsForWidgetApis(req, res);
      }
    }

    if (!isPublicApi(pathname)) {
      const token = await getToken({ req, secret: middlewareSecret });
      if (!token) {
        const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        applySecurityHeaders(res);
        return withCorsForWidgetApis(req, res);
      }
    }
  }

  if (pathname.startsWith("/dashboard")) {
    const token = await getToken({ req, secret: middlewareSecret });
    if (!token) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", pathname);
      const res = NextResponse.redirect(login);
      applySecurityHeaders(res);
      return res;
    }

    if (
      pathname !== "/onboarding" &&
      !pathname.startsWith("/api/") &&
      token.onboardingCompleted === false &&
      req.cookies.get("hq_onboarding_done")?.value !== "1"
    ) {
      const res = NextResponse.redirect(new URL("/onboarding", req.url));
      applySecurityHeaders(res);
      return res;
    }
  }

  if (pathname === "/onboarding" || pathname === "/emotional-wellness") {
    const token = await getToken({ req, secret: middlewareSecret });
    if (!token) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", pathname);
      const res = NextResponse.redirect(login);
      applySecurityHeaders(res);
      return res;
    }
  }

  const res = NextResponse.next();
  applySecurityHeaders(res);
  return withCorsForWidgetApis(req, res);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/onboarding",
    "/emotional-wellness",
  ],
};
