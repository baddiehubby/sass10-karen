import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
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
    return fallback ? { ...fallback, eidataConsentCompleted: true } : null;
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
    return fallback ? { ...fallback, eidataConsentCompleted: true } : null;
  }
}

/** Create a local user row for a Google-authenticated email (idempotent). */
async function ensureGoogleUser(email: string, displayName?: string | null) {
  const normalized = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) return existing;

  const created = await prisma.user.create({
    data: {
      email: normalized,
      password: await bcrypt.hash(Math.random().toString(36), 10),
      name: displayName || normalized,
    },
  });
  await ensureFreeLicenseForUser(created.id);
  return created;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
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
    async signIn({ user, account }) {
      // Never deny Google sign-in here — returning false maps to error=AccessDenied.
      // Provisioning failures are retried in the jwt callback.
      if (account?.provider === "google" && user.email) {
        try {
          await ensureGoogleUser(user.email, user.name);
        } catch (err) {
          console.error("[auth] google signIn provisioning failed (login still allowed)", err);
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // OAuth providers supply their own subject id — always resolve our DB user id by email.
      if (user?.id && account?.provider === "credentials") {
        token.id = user.id;
      }

      const email = (user?.email || token.email || "").toString().toLowerCase();

      const adminList = (process.env.BUDDY_ADMIN_EMAILS || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      token.isAdmin = Boolean(email && adminList.length > 0 && adminList.includes(email));

      // Only hit the DB on new sign-ins (user object present) or when we don't yet have an id.
      // Refreshes of an existing valid token skip the DB call entirely.
      const needsDbLookup = Boolean(user) || !token.id;
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
        if (!dbUser.onboardingCompleted && dbUser._count.licenses > 0) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { onboardingCompleted: true },
            select: { id: true },
          });
          dbUser.onboardingCompleted = true;
        }
        if (dbUser._count.licenses === 0) {
          await ensureFreeLicenseForUser(dbUser.id);
        }
        await ensureDefaultConsents(dbUser.id);
        token.id = dbUser.id;
        token.onboardingCompleted = dbUser.onboardingCompleted;
        token.eidataConsentCompleted = Boolean(dbUser.eidataConsentCompleted ?? true);
        token.companionName = dbUser.companionName || "";
        token.personality = dbUser.personality || "";
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
        (session.user as { isAdmin?: boolean }).isAdmin = Boolean(token.isAdmin);
        (session.user as { eidataConsentCompleted?: boolean }).eidataConsentCompleted = Boolean(
          token.eidataConsentCompleted,
        );
      }
      return session;
    },
    async redirect({ url }) {
      const siteUrl = getCanonicalSiteUrl();
      // Allow explicit dashboard callbacks; force everything else to /dashboard
      if (url.startsWith("/dashboard")) return `${siteUrl}${url}`;
      try {
        const target = new URL(url);
        const allowed = new URL(siteUrl);
        if (target.origin === allowed.origin && target.pathname.startsWith("/dashboard")) {
          return url;
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
