import { NextResponse, type NextRequest } from "next/server";
import { getCanonicalSiteUrl, getGoogleOAuthRedirectUri, PRODUCTION_SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const DEBUG_SECRET = "debug2026";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== DEBUG_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim() || "";
  const googleClientIdSet = Boolean(process.env.GOOGLE_CLIENT_ID?.trim());
  const googleClientSecretSet = Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());
  const nextAuthSecretSet = Boolean(process.env.NEXTAUTH_SECRET?.trim());
  const canonical = getCanonicalSiteUrl();
  const googleRedirectUri = getGoogleOAuthRedirectUri();

  return NextResponse.json({
    ok: true,
    productionSiteUrl: PRODUCTION_SITE_URL,
    envNextAuthUrl: nextAuthUrl || null,
    canonicalSiteUrl: canonical,
    googleRedirectUri,
    redirectUriMatchesProduction:
      googleRedirectUri === "https://www.buddieai.com/api/auth/callback/google",
    googleClientIdSet,
    googleClientSecretSet,
    nextAuthSecretSet,
    nextAuthSecretLength: process.env.NEXTAUTH_SECRET?.length ?? 0,
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
