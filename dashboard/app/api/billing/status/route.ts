import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getUserEntitlement } from "@/lib/billing/entitlement";

export const dynamic = "force-dynamic";

/** Server-authoritative billing snapshot — never trust client paid flags. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entitlement = await getUserEntitlement(session.user.id);
  return NextResponse.json({
    hasPaidAccess: entitlement.hasPaidAccess,
    entitlements: entitlement.entitlements,
    subscriptionLabel: entitlement.subscriptionLabel,
    status: entitlement.status,
    currentPeriodEnd: entitlement.currentPeriodEnd,
    portalUrl: entitlement.portalUrl,
    source: entitlement.source,
    plan: entitlement.plan,
    // Never expose provider secrets; portal URL is customer-facing only.
  });
}
