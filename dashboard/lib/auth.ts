import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { ensureFreeLicenseForUser } from "@/lib/free-license";
import { prisma } from "@/lib/prisma";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const authSecret = process.env.NEXTAUTH_SECRET;

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
      if (account?.provider === "google" && user.email) {
        try {
          const email = user.email.toLowerCase();
          const existing = await prisma.user.findUnique({ where: { email } });
          if (!existing) {
            const created = await prisma.user.create({
              data: {
                email,
                password: await bcrypt.hash(Math.random().toString(36), 10),
                name: user.name || user.email,
              },
            });
            await ensureFreeLicenseForUser(created.id);
          }
        } catch (err) {
          console.error("[auth] google signIn", err);
          return false;
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
      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            onboardingCompleted: true,
            companionName: true,
            personality: true,
            _count: { select: { licenses: true } },
          },
        });
        if (dbUser) {
          if (!dbUser.onboardingCompleted && dbUser._count.licenses > 0) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { onboardingCompleted: true },
            });
            dbUser.onboardingCompleted = true;
          }
          if (dbUser._count.licenses === 0) {
            await ensureFreeLicenseForUser(dbUser.id);
          }
          token.id = dbUser.id;
          token.onboardingCompleted = dbUser.onboardingCompleted;
          token.companionName = dbUser.companionName || "";
          token.personality = dbUser.personality || "";
        }
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
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: authSecret,
  debug: true,
};
