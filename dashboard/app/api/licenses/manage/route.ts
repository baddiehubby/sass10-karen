import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { parseJsonBody, parseQuery } from "@/lib/api-json";
import { authOptions } from "@/lib/auth";
import { getFeatureByPlan } from "@/lib/feature-plans";
import { prisma } from "@/lib/prisma";
import { licenseManageBodySchema, licenseManageGetQuerySchema } from "@/lib/validation";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(req, licenseManageBodySchema);
  if (!parsed.ok) return parsed.response;

  const { licenseId, plan } = parsed.data;

  const license = await prisma.license.findUnique({ where: { id: licenseId } });
  if (!license || license.userId !== session.user.id) {
    return NextResponse.json({ error: "License not found" }, { status: 404 });
  }

  const updated = await prisma.license.update({
    where: { id: licenseId },
    data: {
      plan,
      features: JSON.stringify(getFeatureByPlan(plan)),
    },
  });

  return NextResponse.json({ license: updated });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = parseQuery(req, licenseManageGetQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { licenseId, plan } = parsed.data;

  const license = await prisma.license.findUnique({ where: { id: licenseId } });
  if (!license || license.userId !== session.user.id) {
    return NextResponse.json({ error: "License not found" }, { status: 404 });
  }

  await prisma.license.update({
    where: { id: licenseId },
    data: {
      plan,
      features: JSON.stringify(getFeatureByPlan(plan)),
    },
  });

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
