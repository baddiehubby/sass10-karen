import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { NextAuthOptions, Profile } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { buildAuthCookies } from "@/lib/auth-cookies";
import { ensureDefaultConsents } from "@/lib/consent-service";
import { ensureFreeLicenseForUser } from "@/lib/free-license";
import { logAuthFailure, logStructured, safeErrorMessage } from "@/lib/ops/logger";
import { prisma } from "@/lib/prisma";
import {
  getCanonicalSiteUrl,
  logAuthUrlDebug,
  pinNextAuthUrl,
  resolvePostAuthCallbackUrl,
} from "@/lib/site-url";

pinNextAuthUrl();
logAuthUrlDebug("authOptions");

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const authSecret = process.env.NEXTAUTH_SECRET;
const isProdRuntime = process.env.NODE_ENV === "production";

/** Bind JWT to credential material so password rotate / Google attach invalidates old sessions. */
function credentialFingerprint(passwordHash: string): string {
  return createHash("sha256").update(`bdy-auth-v1:${passwordHash}`).digest("hex").slice(0, 32);
}

function invalidateJwtClaims(token: Record<string, unknown>): Record<string, unknown> {
  delete token.id;
  delete token.cred;
  delete token.onboardingCompleted;
  delete token.eidataConsentCompleted;
  delete token.companionName;
  delete token.personality;
  delete token.claimsFreshAt;
  delete token.isAdmin;
  token.email = undefined;
  token.name = undefined;
  token.sub = undefined;
  return token;
}

// Fail closed at runtime in production — not during `next build` page-data collection
// (NEXT_PHASE=phase-production-build) so CI/local builds can complete without secrets.
const isNextProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
if (
  process.env.NODE_ENV === "production" &&
  !isNextProductionBuild &&
  !(authSecret || "").trim()
) {
  throw new Error("NEXTAUTH_SECRET is required in production");
}

type AuthUserSnapshot = {
  id: string;
  password: string;
  onboardingCompleted: boolean;
  eidataConsentCompleted?: boolean;
  companionName: string | null;
  personality: string | null;
  _count: { licenses: number };
};

function isMissingEidataConsentColumn(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybe = err as {
    code?: string;
    meta?: { column?: string };
    message?: string;
  };
  return (
    maybe.code === "P2022" &&
    (maybe.meta?.column === "User.eidataConsentCompleted" ||
      String(maybe.message || "").includes("User.eidataConsentCompleted"))
  );
}

async function findUserForAuthByEmail(email: string): Promise<AuthUserSnapshot | null> {
  try {
    return await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        password: true,
        onboardingCompleted: true,
        eidataConsentCompleted: true,
        companionName: true,
        personality: true,
        _count: { select: { licenses: true } },
      },
    });
  } catch (err) {
    if (!isMissingEidataConsentColumn(err)) throw err;
    console.warn("[auth] missing User.eidataConsentCompleted column; using compatibility fallback by email");
    const fallback = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        password: true,
        onboardingCompleted: true,
        companionName: true,
        personality: true,
        _count: { select: { licenses: true } },
      },
    });
    // Fail closed on consent when column missing in odd states — require consent modal
    return fallback ? { ...fallback, eidataConsentCompleted: false } : null;
  }
}

async function findUserForAuthById(id: string): Promise<AuthUserSnapshot | null> {
  try {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        password: true,
        onboardingCompleted: true,
        eidataConsentCompleted: true,
        companionName: true,
        personality: true,
        _count: { select: { licenses: true } },
      },
    });
  } catch (err) {
    if (!isMissingEidataConsentColumn(err)) throw err;
    console.warn("[auth] missing User.eidataConsentCompleted column; using compatibility fallback by id");
    const fallback = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        password: true,
        onboardingCompleted: true,
        companionName: true,
        personality: true,
        _count: { select: { licenses: true } },
      },
    });
    return fallback ? { ...fallback, eidataConsentCompleted: false } : null;
  }
}

async function unusablePasswordHash(): Promise<string> {
  return bcrypt.hash(randomBytes(32).toString("hex"), 10);
}

/**
 * Production may lag schema.prisma (P2022 on additive columns).
 * Idempotent ADD COLUMN — safe to call on every Google provisioning attempt.
 * Uses the runtime DATABASE_URL on Vercel (local CLI may redact secrets).
 */
let authSchemaColumnEnsure: Promise<void> | null = null;

function ensureAuthSchemaColumns(): Promise<void> {
  if (!authSchemaColumnEnsure) {
    authSchemaColumnEnsure = (async () => {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "eidataConsentCompleted" BOOLEAN NOT NULL DEFAULT false`,
        );
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "License" ADD COLUMN IF NOT EXISTS "widgetSessionToken" TEXT`,
        );
      } catch (err) {
        // Allow retry on next sign-in if DDL was denied or DB briefly unavailable.
        authSchemaColumnEnsure = null;
        console.warn(
          "[auth] could not ensure auth-related columns:",
          safeErrorMessage(err),
        );
      }
    })();
  }
  return authSchemaColumnEnsure;
}

async function attachFreeLicenseBestEffort(userId: string): Promise<void> {
  try {
    await ensureFreeLicenseForUser(userId);
  } catch (err) {
    // License bootstrap must never deny Google OAuth — dashboard can retry later.
    console.warn(
      "[auth] free license bootstrap deferred:",
      safeErrorMessage(err),
    );
  }
}

/**
 * Create or attach Google-authenticated email.
 * If a pre-registered password account exists, Google email ownership wins:
 * rotate password so an attacker who registered first cannot keep credentials access.
 */
async function ensureGoogleUser(email: string, displayName?: string | null) {
  const normalized = email.toLowerCase();
  await ensureAuthSchemaColumns();

  // Narrow select — never SELECT * so a missing optional column cannot deny OAuth.
  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, name: true },
  });
  if (existing) {
    // Narrow select on update — Prisma returns all scalars by default and P2022 on
    // User.eidataConsentCompleted would otherwise deny returning Google users.
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password: await unusablePasswordHash(),
        name: existing.name || displayName || normalized,
      },
      select: { id: true },
    });
    await attachFreeLicenseBestEffort(existing.id);
    return existing;
  }

  const password = await unusablePasswordHash();
  const name = displayName || normalized;
  try {
    const created = await prisma.user.create({
      data: {
        email: normalized,
        password,
        name,
      },
      select: { id: true, name: true },
    });
    await attachFreeLicenseBestEffort(created.id);
    return created;
  } catch (err) {
    if (!isMissingEidataConsentColumn(err)) throw err;
    // Schema still missing the column (DDL denied) — insert without it.
    console.warn("[auth] Google user create falling back without eidataConsentCompleted");
    const id = `c${randomBytes(16).toString("hex")}`;
    await prisma.$executeRaw`
      INSERT INTO "User" ("id", "email", "password", "name", "onboardingCompleted", "createdAt", "updatedAt")
      VALUES (${id}, ${normalized}, ${password}, ${name}, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    await attachFreeLicenseBestEffort(id);
    return { id, name };
  }
}

function googleEmailVerified(profile: Profile | undefined): boolean {
  // NextAuth sometimes omits profile on signIn; Google already authenticated the account.
  // Deny only an explicit unverified flag — never missing profile / missing field.
  if (!profile || typeof profile !== "object") return true;
  const p = profile as Profile & { email_verified?: boolean | string };
  if (p.email_verified === false || p.email_verified === "false") return false;
  return true;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 14,
    // Refresh + credential fingerprint check at least hourly (logout / Google attach revoke).
    updateAge: 60 * 60,
  },
  useSecureCookies: isProdRuntime,
  cookies: buildAuthCookies(isProdRuntime),
  providers: [
    ...(googleClientId && googleClientSecret
      ? [
          GoogleProvider({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            // Explicit — do not disable. NextAuth Google defaults include these; pin them.
            checks: ["pkce", "state"],
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && user.email) {
        if (!googleEmailVerified(profile)) {
          console.warn("[auth] rejected Google sign-in without verified email");
          logAuthFailure({ reason: "oauth_unverified" });
          return false;
        }
        try {
          await ensureGoogleUser(user.email, user.name);
        } catch (err) {
          const prismaMeta =
            err && typeof err === "object"
              ? (err as { code?: string; meta?: { column?: string; modelName?: string } })
              : null;
          const detail = [
            safeErrorMessage(err),
            prismaMeta?.code,
            prismaMeta?.meta?.modelName,
            prismaMeta?.meta?.column,
          ]
            .filter(Boolean)
            .join(":");
          console.error("[auth] google signIn provisioning failed — denying login", detail);
          logAuthFailure({ reason: "oauth_provision_failed" });
          logStructured({
            level: "error",
            msg: "google provisioning failed",
            event: "auth.failure",
            reason: "oauth_provision_failed",
            errorCode: detail || safeErrorMessage(err),
          });
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      if (user?.id && account?.provider === "credentials") {
        token.id = user.id;
      }

      const email = (user?.email || token.email || "").toString().toLowerCase();

      const adminList = (process.env.BUDDY_ADMIN_EMAILS || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      // Always recompute admin from env (never sticky after env removal)
      token.isAdmin = Boolean(email && adminList.length > 0 && adminList.includes(email));

      const lastFresh = typeof token.claimsFreshAt === "number" ? token.claimsFreshAt : 0;
      const stale = Date.now() - lastFresh > 60 * 60 * 1000;
      const needsDbLookup = Boolean(user) || !token.id || stale || trigger === "update";
      if (!needsDbLookup || !email) return token;

      let dbUser = await findUserForAuthByEmail(email);

      if (!dbUser && account?.provider === "google") {
        try {
          const created = await ensureGoogleUser(email, user?.name);
          dbUser = await findUserForAuthById(created.id);
        } catch (err) {
          console.error("[auth] jwt google provisioning");
          logStructured({
            level: "error",
            msg: "jwt google provisioning failed",
            event: "auth.failure",
            reason: "oauth_provision_failed",
            errorCode: safeErrorMessage(err),
          });
          return invalidateJwtClaims(token as Record<string, unknown>) as typeof token;
        }
      }

      if (!dbUser) {
        // Deleted / unknown account — drop identity claims (forces re-auth).
        return invalidateJwtClaims(token as Record<string, unknown>) as typeof token;
      }

      const cred = credentialFingerprint(dbUser.password);
      if (typeof token.cred === "string" && token.cred !== cred) {
        // Password rotated (e.g. Google attach) or credentials changed — invalidate.
        return invalidateJwtClaims(token as Record<string, unknown>) as typeof token;
      }

      if (dbUser._count.licenses === 0) {
        try {
          await ensureFreeLicenseForUser(dbUser.id);
        } catch (err) {
          console.warn(
            "[auth] jwt free license bootstrap deferred:",
            safeErrorMessage(err),
          );
        }
      }
      try {
        await ensureDefaultConsents(dbUser.id);
      } catch (err) {
        console.warn("[auth] ensureDefaultConsents deferred:", safeErrorMessage(err));
      }
      token.id = dbUser.id;
      token.cred = cred;
      token.onboardingCompleted = dbUser.onboardingCompleted;
      token.eidataConsentCompleted = Boolean(dbUser.eidataConsentCompleted ?? false);
      token.companionName = dbUser.companionName || "";
      token.personality = dbUser.personality || "";
      token.claimsFreshAt = Date.now();
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const email = (session.user.email || token.email || "").toString().toLowerCase();
        // Identity only from verified JWT claims — never invent from client.
        const userId = typeof token.id === "string" ? token.id : "";
        session.user.id = userId;
        if (!userId) {
          // Expired / invalidated JWT — present empty session user id so API gates 401.
          (session.user as { onboardingCompleted?: boolean }).onboardingCompleted = false;
          (session.user as { eidataConsentCompleted?: boolean }).eidataConsentCompleted = false;
          (session.user as { isAdmin?: boolean }).isAdmin = false;
          return session;
        }
        (session.user as { onboardingCompleted?: boolean }).onboardingCompleted = Boolean(token.onboardingCompleted);
        (session.user as { companionName?: string }).companionName = String(token.companionName || "");
        (session.user as { personality?: string }).personality = String(token.personality || "");
        const adminList = (process.env.BUDDY_ADMIN_EMAILS || "")
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        (session.user as { isAdmin?: boolean }).isAdmin = Boolean(
          email && adminList.length > 0 && adminList.includes(email),
        );
        (session.user as { eidataConsentCompleted?: boolean }).eidataConsentCompleted = Boolean(
          token.eidataConsentCompleted,
        );
      }
      return session;
    },
    async redirect({ url }) {
      const siteUrl = getCanonicalSiteUrl();
      // Protocol-relative and absolute off-origin URLs must not win
      if (url.startsWith("/") && !url.startsWith("//")) {
        const path = url.startsWith("/") ? url : `/${url}`;
        if (path.startsWith("//") || path.startsWith("/\\")) {
          return resolvePostAuthCallbackUrl("/dashboard");
        }
        return resolvePostAuthCallbackUrl(path);
      }
      try {
        const target = new URL(url);
        const allowed = new URL(siteUrl);
        if (target.origin === allowed.origin) {
          return resolvePostAuthCallbackUrl(`${target.pathname}${target.search}${target.hash}`);
        }
      } catch {
        /* ignore malformed url */
      }
      return resolvePostAuthCallbackUrl("/dashboard");
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: authSecret,
  debug: process.env.NODE_ENV === "development",
};
