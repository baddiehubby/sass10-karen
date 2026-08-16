import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getUserEntitlement } from "@/lib/billing/entitlement";
import { syncSubscriptionFromLemon } from "@/lib/billing/sync";

export const dynamic = "force-dynamic";

/**
 * Soft-pull subscription state from Lemon.
 * If Lemon is unreachable, existing entitlement is preserved.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sync = await syncSubscriptionFromLemon(session.user.id);
  const entitlement = await getUserEntitlement(session.user.id);

  return NextResponse.json({
    sync,
    hasPaidAccess: entitlement.hasPaidAccess,
    entitlements: entitlement.entitlements,
    subscriptionLabel: entitlement.subscriptionLabel,
    status: entitlement.status,
    currentPeriodEnd: entitlement.currentPeriodEnd,
    portalUrl: entitlement.portalUrl,
    source: entitlement.source,
    plan: entitlement.plan,
  });
}
