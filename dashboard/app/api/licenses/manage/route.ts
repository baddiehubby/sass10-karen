import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-json";
import { authOptions } from "@/lib/auth";
import { isActiveLemonSubscriptionStatus } from "@/lib/lemonsqueezy";
import { prisma } from "@/lib/prisma";
import { licenseManageBodySchema } from "@/lib/validation";

const PAID_PLANS = new Set(["starter", "pro", "agency", "enterprise"]);

/** Plan upgrades are only applied via Lemon Squeezy webhooks — not manual API calls. */
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

  if (PAID_PLANS.has(plan)) {
    const hasBilling =
      Boolean(license.lemonSqueezySubscriptionId) &&
      isActiveLemonSubscriptionStatus(license.lemonSqueezySubscriptionStatus);
    if (!hasBilling) {
      return NextResponse.json(
        {
          error: "Paid plans require an active Lemon Squeezy subscription. Use checkout or the customer portal.",
        },
        { status: 403 },
      );
    }
  }

  return NextResponse.json(
    { error: "Manual plan changes are disabled. Manage billing via Lemon Squeezy." },
    { status: 403 },
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error:
        "Direct plan changes are disabled. Subscribe via /pricing or use your Lemon Squeezy customer portal.",
    },
    { status: 403 },
  );
}
