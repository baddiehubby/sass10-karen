import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { nextAuthSecureCookies, nextAuthSessionCookieName } from "@/lib/authz";
import { buildAppRedirectUrl, buildLoginRedirectUrl } from "@/lib/canonical-request-url";
import { getTrustedClientIp } from "@/lib/client-ip";
import { resolveRequestId } from "@/lib/ops/request-id";
import { getTenant, TENANT_COOKIE, TENANT_HEADER } from "@/lib/tenant";

const middlewareSecret = process.env.NEXTAUTH_SECRET;

async function readSessionToken(req: NextRequest) {
  return getToken({
    req,
    secret: middlewareSecret,
    secureCookie: nextAuthSecureCookies(),
    cookieName: nextAuthSessionCookieName(),
  });
}

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
  return getTrustedClientIp(req);
}

function applySecurityHeaders(res: NextResponse, opts?: { document?: boolean }) {
  const h = res.headers;
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("X-XSS-Protection", "1; mode=block");
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Document pages: allow Next.js + same-origin assets; frame-ancestors deny (widgets are not iframed as app pages).
  // API routes keep a tighter default-src.
  if (opts?.document) {
    h.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://www.buddieai.com https://*.lemonsqueezy.com https://*.sentry.io https://*.ingest.sentry.io",
        "frame-src 'self' https://*.lemonsqueezy.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self' https://*.lemonsqueezy.com",
      ].join("; "),
    );
  } else {
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
  // Short-lived widget JWT exchange (license key or owner session enforced in-route).
  "/api/licenses/widget-credential",
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
  "/api/download/desktop-companion",
  "/api/download/buddy-extension",
  "/api/health",
  "/api/ready",
  // License-key authenticated in-route (overlay / SW / extension). Not session JWT.
  "/api/presence",
];

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function applyTenantContext(req: NextRequest, res: NextResponse) {
  const host = req.headers.get("host") || req.nextUrl.hostname;
  const tenant = getTenant(host);
  res.cookies.set(TENANT_COOKIE, tenant, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  res.headers.set(TENANT_HEADER, tenant);
  return res;
}

function nextWithTenant(req: NextRequest, requestId?: string) {
  const host = req.headers.get("host") || req.nextUrl.hostname;
  const tenant = getTenant(host);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(TENANT_HEADER, tenant);
  if (requestId) requestHeaders.set("x-request-id", requestId);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  return applyTenantContext(req, res);
}

function withCorsForWidgetApis(req: NextRequest, res: NextResponse) {
  const p = req.nextUrl.pathname;
  if (
    p.startsWith("/api/analytics/event") ||
    p.startsWith("/api/analytics/anonymized-event") ||
    p.startsWith("/api/eidata/anonymized-event") ||
    p.startsWith("/api/consent/status") ||
    p.startsWith("/api/licenses/verify") ||
    p.startsWith("/api/licenses/widget-credential") ||
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
  const requestId = resolveRequestId(req.headers);

  const stamp = (res: NextResponse) => {
    res.headers.set("x-request-id", requestId);
    return res;
  };

  if (pathname.startsWith("/api/")) {
    // Lemon webhooks: do not IP-rate-limit before signature verify (retries must land).
    const isLemonWebhook = pathname.startsWith("/api/lemonsqueezy/webhook");

    if (!isLemonWebhook) {
      const rateKey = pathname.startsWith("/api/auth/")
        ? `auth:${ip}:${pathname}`
        : `api:${ip}:${pathname}`;

      let max = 60;
      if (pathname.startsWith("/api/auth/")) max = 8;
      if (pathname.includes("/register") || pathname.includes("/callback/credentials")) max = 5;
      if (pathname.startsWith("/api/widget/mood")) max = 30;
      if (pathname.startsWith("/api/licenses/widget-credential")) max = 20;
      if (pathname.startsWith("/api/auth/register") || pathname.startsWith("/api/auth/login")) max = 5;

      if (!allowRate(rateKey, max, WINDOW_MS)) {
        const res = NextResponse.json({ error: "Too many requests" }, { status: 429 });
        applySecurityHeaders(res);
        return stamp(withCorsForWidgetApis(req, applyTenantContext(req, res)));
      }
    }

    if (!isPublicApi(pathname)) {
      const token = await readSessionToken(req);
      // Coarse gate — handlers still derive identity via getServerSession / sessionUserId.
      if (!token || typeof token.id !== "string" || !token.id) {
        const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        applySecurityHeaders(res);
        return stamp(withCorsForWidgetApis(req, applyTenantContext(req, res)));
      }
    }
  }

  if (
    pathname === "/dashboard" ||
    (pathname.startsWith("/dashboard/") && !pathname.startsWith("/dashboard/debiopwr"))
  ) {
    const token = await readSessionToken(req);
    if (!token || typeof token.id !== "string" || !token.id) {
      const login = buildLoginRedirectUrl(pathname);
      const res = applyTenantContext(req, NextResponse.redirect(login));
      applySecurityHeaders(res, { document: true });
      return stamp(res);
    }
    if (!token.eidataConsentCompleted) {
      const consent = buildAppRedirectUrl("/consent");
      const res = applyTenantContext(req, NextResponse.redirect(consent));
      applySecurityHeaders(res, { document: true });
      res.headers.set("Cache-Control", "private, no-store");
      return stamp(res);
    }
    const next = nextWithTenant(req, requestId);
    applySecurityHeaders(next, { document: true });
    next.headers.set("Cache-Control", "private, no-store");
    return stamp(withCorsForWidgetApis(req, next));
  }

  if (pathname === "/consent") {
    const token = await readSessionToken(req);
    if (!token || typeof token.id !== "string" || !token.id) {
      const login = buildLoginRedirectUrl("/consent");
      const res = applyTenantContext(req, NextResponse.redirect(login));
      applySecurityHeaders(res, { document: true });
      return stamp(res);
    }
  }

  if (pathname === "/debiopwr" || pathname.startsWith("/debiopwr/")) {
    const token = await readSessionToken(req);
    if (!token || typeof token.id !== "string" || !token.id) {
      const login = buildLoginRedirectUrl("/debiopwr");
      const res = applyTenantContext(req, NextResponse.redirect(login));
      applySecurityHeaders(res, { document: true });
      return stamp(res);
    }
  }

  const res = nextWithTenant(req, requestId);
  applySecurityHeaders(res, { document: true });
  return stamp(withCorsForWidgetApis(req, res));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|css|js|map)$).*)",
  ],
};
