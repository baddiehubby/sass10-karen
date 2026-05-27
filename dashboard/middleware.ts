import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const middlewareSecret = process.env.NEXTAUTH_SECRET;

/** In-memory fixed-window rate limits (per Edge instance). */
const rateBucket = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;

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

function applySecurityHeaders(res: NextResponse, opts?: { document?: boolean }) {
  const h = res.headers;
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("X-XSS-Protection", "1; mode=block");
  h.set("Strict-Transport-Security", "max-age=31536000");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Strict default-src breaks Next.js pages; API routes get a minimal CSP. App pages rely on globals.css font stack.
  if (!opts?.document) {
    h.set(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:;",
    );
  }
}

/** Public widget / auth endpoints (no session JWT). */
const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/licenses/verify",
  "/api/licenses/theme",
  "/api/widget/mood",
  "/api/analytics/event",
  "/api/analytics/anonymized-event",
  "/api/eidata/anonymized-event",
  "/api/consent/status",
  "/api/security/tamper-attempt",
  "/api/lemonsqueezy/webhook",
  "/api/challenge/report",
  "/api/dev/widget",
  "/api/extensions/stats",
];

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function withCorsForWidgetApis(req: NextRequest, res: NextResponse) {
  const p = req.nextUrl.pathname;
  if (
    p.startsWith("/api/analytics/event") ||
    p.startsWith("/api/analytics/anonymized-event") ||
    p.startsWith("/api/eidata/anonymized-event") ||
    p.startsWith("/api/consent/status") ||
    p.startsWith("/api/licenses/verify") ||
    p.startsWith("/api/security/tamper-attempt") ||
    p.startsWith("/api/extensions/stats")
  ) {
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Buddy-Widget-Opt-In");
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = clientIp(req);

  if (pathname.startsWith("/api/")) {
    const rateKey = pathname.startsWith("/api/auth/")
      ? `auth:${ip}:${pathname}`
      : `api:${ip}:${pathname}`;

    const max = pathname.startsWith("/api/auth/") ? 5 : 60;
    if (!allowRate(rateKey, max, WINDOW_MS)) {
      const res = NextResponse.json({ error: "Too many requests" }, { status: 429 });
      applySecurityHeaders(res);
      return withCorsForWidgetApis(req, res);
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

  if (
    pathname === "/dashboard" ||
    (pathname.startsWith("/dashboard/") && !pathname.startsWith("/dashboard/debiopwr"))
  ) {
    const token = await getToken({ req, secret: middlewareSecret });
    if (!token) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", pathname);
      const res = NextResponse.redirect(login);
      applySecurityHeaders(res, { document: true });
      return res;
    }
    if (!token.eidataConsentCompleted) {
      const consent = new URL("/consent", req.url);
      const res = NextResponse.redirect(consent);
      applySecurityHeaders(res, { document: true });
      return res;
    }
  }

  if (pathname === "/consent") {
    const token = await getToken({ req, secret: middlewareSecret });
    if (!token) {
      const login = new URL("/login", req.url);
      const res = NextResponse.redirect(login);
      applySecurityHeaders(res, { document: true });
      return res;
    }
  }

  if (pathname === "/debiopwr" || pathname.startsWith("/debiopwr/")) {
    const token = await getToken({ req, secret: middlewareSecret });
    if (!token) {
      const login = new URL("/login", req.url);
      const res = NextResponse.redirect(login);
      applySecurityHeaders(res, { document: true });
      return res;
    }
  }

  const res = NextResponse.next();
  applySecurityHeaders(res, { document: true });
  return withCorsForWidgetApis(req, res);
}

export const config = {
  matcher: ["/api/:path*", "/dashboard", "/dashboard/:path*", "/consent", "/debiopwr"],
};
