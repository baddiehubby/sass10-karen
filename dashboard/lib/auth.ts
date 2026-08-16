import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { NextAuthOptions, Profile } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { ensureDefaultConsents } from "@/lib/consent-service";
import { ensureFreeLicenseForUser } from "@/lib/free-license";
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
 * Create or attach Google-authenticated email.
 * If a pre-registered password account exists, Google email ownership wins:
 * rotate password so an attacker who registered first cannot keep credentials access.
 */
async function ensureGoogleUser(email: string, displayName?: string | null) {
  const normalized = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password: await unusablePasswordHash(),
        name: existing.name || displayName || normalized,
      },
    });
    return existing;
  }

  const created = await prisma.user.create({
    data: {
      email: normalized,
      password: await unusablePasswordHash(),
      name: displayName || normalized,
    },
  });
  await ensureFreeLicenseForUser(created.id);
  return created;
}

function googleEmailVerified(profile: Profile | undefined): boolean {
  if (!profile || typeof profile !== "object") return false;
  const p = profile as Profile & { email_verified?: boolean };
  return p.email_verified === true;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 6, // refresh claims every 6h
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    ...(googleClientId && googleClientSecret
      ? [
          GoogleProvider({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
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
          return false;
        }
        try {
          await ensureGoogleUser(user.email, user.name);
        } catch (err) {
          console.error("[auth] google signIn provisioning failed (login still allowed)", err);
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
      const stale = Date.now() - lastFresh > 6 * 60 * 60 * 1000;
      const needsDbLookup = Boolean(user) || !token.id || stale || trigger === "update";
      if (!needsDbLookup || !email) return token;

      let dbUser = await findUserForAuthByEmail(email);

      if (!dbUser && account?.provider === "google") {
        try {
          const created = await ensureGoogleUser(email, user?.name);
          dbUser = await findUserForAuthById(created.id);
        } catch (err) {
          console.error("[auth] jwt google provisioning", err);
        }
      }

      if (dbUser) {
        if (dbUser._count.licenses === 0) {
          await ensureFreeLicenseForUser(dbUser.id);
        }
        await ensureDefaultConsents(dbUser.id);
        token.id = dbUser.id;
        token.onboardingCompleted = dbUser.onboardingCompleted;
        token.eidataConsentCompleted = Boolean(dbUser.eidataConsentCompleted ?? false);
        token.companionName = dbUser.companionName || "";
        token.personality = dbUser.personality || "";
        token.claimsFreshAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const email = (session.user.email || token.email || "").toString().toLowerCase();
        let userId = typeof token.id === "string" ? token.id : "";
        if (!userId && email) {
          try {
            const dbUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
            if (dbUser) userId = dbUser.id;
          } catch (err) {
            console.error("[auth] session resolve user id", err);
          }
        }
        session.user.id = userId;
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
