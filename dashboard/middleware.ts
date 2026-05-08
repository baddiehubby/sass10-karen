import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

const middlewareSecret = process.env.NEXTAUTH_SECRET;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/" ||
    pathname === "/about" ||
    pathname === "/demo" ||
    pathname === "/pricing" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/challenge" ||
    pathname === "/shopify" ||
    pathname === "/integrations" ||
    pathname === "/state-of-ai-emotions" ||
    pathname === "/docs" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/product-hunt" ||
    pathname === "/blog" ||
    pathname.startsWith("/blog/");

  if (isPublic) {
    return NextResponse.next();
  }

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname === "/emotional-wellness" ||
    pathname === "/api/licenses/generate" ||
    pathname === "/api/lemonsqueezy/create-checkout" ||
    pathname === "/api/outreach/send";

  if (!isProtected) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: middlewareSecret,
  });

  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  if (
    pathname !== "/onboarding" &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth") &&
    token.onboardingCompleted === false &&
    req.cookies.get("hq_onboarding_done")?.value !== "1"
  ) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding",
    "/emotional-wellness",
    "/api/licenses/generate",
    "/api/lemonsqueezy/create-checkout",
    "/api/outreach/send",
  ],
};
