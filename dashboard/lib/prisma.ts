import { PrismaClient } from "@prisma/client";

/**
 * Global singleton — critical on Vercel serverless.
 * Without caching on `globalThis`, warm isolates can open extra pools and
 * exhaust Postgres connection limits (runtime 500s).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

globalForPrisma.prisma = prisma;
