import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
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
        const existing = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
        if (!existing) {
          await prisma.user.create({
            data: {
              email: user.email.toLowerCase(),
              // OAuth users do not use password login by default.
              password: await bcrypt.hash(Math.random().toString(36), 10),
              name: user.name || user.email,
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
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
        session.user.id = token.id as string;
        (session.user as { onboardingCompleted?: boolean }).onboardingCompleted = Boolean(token.onboardingCompleted);
        (session.user as { companionName?: string }).companionName = String(token.companionName || "");
        (session.user as { personality?: string }).personality = String(token.personality || "");
        (session.user as { isAdmin?: boolean }).isAdmin = Boolean(token.isAdmin);
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: authSecret,
  debug: true,
};
