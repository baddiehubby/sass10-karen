import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerBillingSnapshot } from "@/lib/billing/entitlement";
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
  const snapshot = await getServerBillingSnapshot(session.user.id);

  return NextResponse.json({
    sync,
    entitlements: snapshot.entitlements,
    subscriptionLabel: snapshot.subscriptionLabel,
    status: snapshot.status,
    currentPeriodEnd: snapshot.currentPeriodEnd,
    portalUrl: snapshot.portalUrl,
    source: snapshot.source,
  });
}
