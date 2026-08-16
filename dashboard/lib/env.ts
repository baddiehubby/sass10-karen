/**
 * Production environment validation — fail fast, never silently use localhost/dev secrets in prod.
 * Skipped during `next build` page collection (NEXT_PHASE=phase-production-build).
 */

export type EnvIssue = { key: string; message: string };

const PLACEHOLDER_RE = /^(YOUR_VALUE_HERE|PLACEHOLDER|changeme|xxx+)$/i;
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i;

function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function present(value: string | undefined): boolean {
  const v = value?.trim() ?? "";
  return Boolean(v) && !PLACEHOLDER_RE.test(v);
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" && !isBuildPhase();
}

/** Collect production configuration problems (does not throw). */
export function collectProductionEnvIssues(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): EnvIssue[] {
  const issues: EnvIssue[] = [];

  if (!present(env.DATABASE_URL)) {
    issues.push({ key: "DATABASE_URL", message: "required PostgreSQL connection string" });
  } else if (/sqlite|file:/i.test(env.DATABASE_URL!)) {
    issues.push({ key: "DATABASE_URL", message: "must be PostgreSQL in production (not SQLite)" });
  }

  if (!present(env.NEXTAUTH_SECRET) || (env.NEXTAUTH_SECRET?.trim().length ?? 0) < 16) {
    issues.push({ key: "NEXTAUTH_SECRET", message: "required (≥16 chars)" });
  }

  const nextAuthUrl = env.NEXTAUTH_URL?.trim();
  if (nextAuthUrl && LOCALHOST_RE.test(nextAuthUrl) && env.VERCEL_ENV === "production") {
    issues.push({ key: "NEXTAUTH_URL", message: "must not be localhost on Vercel production" });
  }

  const site = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site && LOCALHOST_RE.test(site) && env.VERCEL_ENV === "production") {
    issues.push({ key: "NEXT_PUBLIC_SITE_URL", message: "must not be localhost on Vercel production" });
  }

  const app = env.NEXT_PUBLIC_APP_URL?.trim();
  if (app && LOCALHOST_RE.test(app) && env.VERCEL_ENV === "production") {
    issues.push({ key: "NEXT_PUBLIC_APP_URL", message: "must not be localhost on Vercel production" });
  }

  // Google OAuth — only required when configured as a pair
  const gId = env.GOOGLE_CLIENT_ID?.trim();
  const gSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (present(gId) !== present(gSecret)) {
    issues.push({
      key: "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET",
      message: "both required together when Google OAuth is enabled",
    });
  }

  if (!present(env.LEMONSQUEEZY_WEBHOOK_SECRET)) {
    issues.push({ key: "LEMONSQUEEZY_WEBHOOK_SECRET", message: "required for signed billing webhooks" });
  }

  if (!present(env.LEMONSQUEEZY_API_KEY)) {
    issues.push({ key: "LEMONSQUEEZY_API_KEY", message: "required for checkout + portal sync" });
  }

  const hasStarter = present(env.LEMONSQUEEZY_STARTER_VARIANT_ID);
  const hasPro = present(env.LEMONSQUEEZY_PRO_VARIANT_ID);
  const hasPremium =
    present(env.LEMONSQUEEZY_PREMIUM_VARIANT_ID) || present(env.LEMONSQUEEZY_AGENCY_VARIANT_ID);
  if (!hasStarter || !hasPro || !hasPremium) {
    issues.push({
      key: "LEMONSQUEEZY_*_VARIANT_ID",
      message: "Starter, Pro, and Premium (or Agency) variant IDs are required for checkout",
    });
  }

  if (!present(env.EIDATA_HASH_SALT)) {
    issues.push({ key: "EIDATA_HASH_SALT", message: "required for anonymized session hashing" });
  }

  return issues;
}

/**
 * Throw in production runtime when mandatory configuration is missing.
 * Safe during `next build` and local development.
 */
export function assertProductionEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): void {
  if (!isProductionRuntime()) return;
  const issues = collectProductionEnvIssues(env);
  if (!issues.length) return;
  const detail = issues.map((i) => `${i.key}: ${i.message}`).join("; ");
  throw new Error(`Production environment invalid — ${detail}`);
}

/** Soft check used by health tooling (never prints values). */
export function productionEnvStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): { ok: boolean; missingKeys: string[] } {
  const issues = collectProductionEnvIssues(env);
  return { ok: issues.length === 0, missingKeys: issues.map((i) => i.key) };
}
