/**
 * Simulates production OAuth URL pinning (no network).
 * Run: node scripts/verify-oauth-callback.mjs
 */

const PRODUCTION_SITE_URL = "https://www.buddieai.com";
const LOCALHOST_URL_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i;
const VERCEL_PREVIEW_HOST_RE = /\.vercel\.app$/i;
const BUDDIE_HOST_RE = /^(www\.)?buddieai\.com$/i;

function normalizeProductionOrigin(url) {
  try {
    const parsed = new URL(url.trim());
    if (VERCEL_PREVIEW_HOST_RE.test(parsed.hostname)) return PRODUCTION_SITE_URL;
    if (BUDDIE_HOST_RE.test(parsed.hostname)) return PRODUCTION_SITE_URL;
  } catch {
    /* ignore */
  }
  return PRODUCTION_SITE_URL;
}

function getCanonicalSiteUrl(env) {
  if (env.NODE_ENV === "production") {
    const explicit = env.NEXTAUTH_URL?.trim();
    if (explicit && LOCALHOST_URL_RE.test(explicit)) {
      return explicit.replace(/\/$/, "");
    }
    if (explicit) return normalizeProductionOrigin(explicit);
    return PRODUCTION_SITE_URL;
  }
  return (env.NEXTAUTH_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

function pin(env) {
  env.NEXTAUTH_URL = getCanonicalSiteUrl(env);
  return env.NEXTAUTH_URL;
}

const cases = [
  {
    name: "Vercel production without NEXTAUTH_URL",
    env: { NODE_ENV: "production", VERCEL_URL: "baddiehubby-1.vercel.app", VERCEL_ENV: "production" },
    expect: PRODUCTION_SITE_URL,
  },
  {
    name: "Vercel preview deployment (NODE_ENV production)",
    env: { NODE_ENV: "production", VERCEL_URL: "baddiehubby-1-abc123.vercel.app", VERCEL_ENV: "preview" },
    expect: PRODUCTION_SITE_URL,
  },
  {
    name: "Local next dev",
    env: { NODE_ENV: "development", NEXTAUTH_URL: "http://localhost:3000" },
    expect: "http://localhost:3000",
  },
  {
    name: "Local next start with localhost NEXTAUTH_URL",
    env: { NODE_ENV: "production", NEXTAUTH_URL: "http://localhost:3000" },
    expect: "http://localhost:3000",
  },
  {
    name: "Production NEXTAUTH_URL without www (must normalize to www)",
    env: { NODE_ENV: "production", NEXTAUTH_URL: "https://buddieai.com" },
    expect: PRODUCTION_SITE_URL,
  },
  {
    name: "Production NEXTAUTH_URL vercel.app preview host (must normalize)",
    env: { NODE_ENV: "production", NEXTAUTH_URL: "https://baddiehubby-final786.vercel.app" },
    expect: PRODUCTION_SITE_URL,
  },
];

let failed = 0;
for (const c of cases) {
  const env = { ...c.env };
  const base = pin(env);
  const redirect = `${base}/api/auth/callback/google`;
  const ok = base === c.expect && redirect === `${c.expect}/api/auth/callback/google`;
  console.log(`${ok ? "PASS" : "FAIL"} ${c.name}`);
  console.log(`  base=${base}`);
  console.log(`  redirect_uri=${redirect}`);
  if (!ok) failed++;
}

process.exit(failed > 0 ? 1 : 0);
