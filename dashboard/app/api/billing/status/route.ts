import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerBillingSnapshot } from "@/lib/billing/entitlement";

export const dynamic = "force-dynamic";

/** Server-authoritative billing snapshot — never trust client paid flags. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getServerBillingSnapshot(session.user.id);
  return NextResponse.json({
    entitlements: snapshot.entitlements,
    subscriptionLabel: snapshot.subscriptionLabel,
    status: snapshot.status,
    currentPeriodEnd: snapshot.currentPeriodEnd,
    portalUrl: snapshot.portalUrl,
    source: snapshot.source,
    // Never expose provider secrets; portal URL is customer-facing only.
    providerSubscriptionId: snapshot.providerSubscriptionId,
  });
}
