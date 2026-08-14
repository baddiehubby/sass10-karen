import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { parseQuery } from "@/lib/api-json";
import { authOptions } from "@/lib/auth";
import { getFeatureByPlan } from "@/lib/feature-plans";
import { generateLicenseKey } from "@/lib/license";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const trialGenerateQuerySchema = z.object({
  plan: z
    .string()
    .max(40)
    .optional()
    .transform((p) => (p == null || p === "" ? "starter" : p.trim().toLowerCase()))
    .pipe(z.literal("starter")),
  domain: z
    .string()
    .max(253)
    .optional()
    .nullable()
    .transform((d) => (d == null || d === "" ? null : d.trim())),
  days: z.coerce.number().min(1).max(14).optional().default(14),
});

/** Creates a short trial license only — paid tiers require Lemon Squeezy checkout. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseQuery(req, trialGenerateQuerySchema);
  if (!parsed.ok) return parsed.response;

  const { plan, domain, days: expiresDays } = parsed.data;

  const paidLicense = await prisma.license.findFirst({
    where: {
      userId: session.user.id,
      plan: { in: ["starter", "pro", "premium", "agency", "enterprise"] },
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (paidLicense) {
    return NextResponse.json(
      { error: "You already have an active paid license. Use the dashboard to copy your embed key." },
      { status: 409 },
    );
  }

  const features = getFeatureByPlan(plan);
  const license = await prisma.license.create({
    data: {
      key: generateLicenseKey(),
      userId: session.user.id,
      plan,
      domain,
      features: JSON.stringify(features),
      expiresAt: new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000),
      activatedAt: new Date(),
    },
  });

  return NextResponse.json({ license });
}
