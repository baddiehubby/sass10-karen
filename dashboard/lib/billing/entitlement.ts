/**
 * Server-side entitlement from Subscription (preferred) with License fallback.
 * Never trust client paid flags.
 */

import { entitlementsForPlan, type LivingBuddyEntitlements } from "@/lib/buddy-entitlements";
import { subscriptionGrantsPremium } from "@/lib/billing/types";
import { isLicenseActive, isPaidPlan } from "@/lib/free-license";
import { prisma } from "@/lib/prisma";
import { consumerSubscriptionLabel } from "@/lib/subscription-entitlement";

export type ServerBillingSnapshot = {
  entitlements: LivingBuddyEntitlements;
  subscriptionLabel: string;
  providerSubscriptionId: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  portalUrl: string | null;
  source: "subscription" | "license" | "sacred_day";
};

export async function getServerBillingSnapshot(userId: string): Promise<ServerBillingSnapshot> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, provider: "lemonsqueezy" },
    orderBy: { updatedAt: "desc" },
  });

  if (sub && subscriptionGrantsPremium(sub)) {
    return {
      entitlements: entitlementsForPlan(sub.plan),
      subscriptionLabel: consumerSubscriptionLabel({
        plan: sub.plan,
        status: sub.status,
        expiresAt: sub.currentPeriodEnd,
      }),
      providerSubscriptionId: sub.providerSubscriptionId,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      portalUrl: sub.customerPortalUrl,
      source: "subscription",
    };
  }

  const licenses = await prisma.license.findMany({ where: { userId } });
  const paid = licenses.find((l) => isPaidPlan(l.plan) && isLicenseActive(l));
  if (paid) {
    return {
      entitlements: entitlementsForPlan(paid.plan),
      subscriptionLabel: consumerSubscriptionLabel({
        plan: paid.plan,
        status: paid.lemonSqueezySubscriptionStatus,
        expiresAt: paid.expiresAt,
      }),
      providerSubscriptionId: paid.lemonSqueezySubscriptionId,
      status: paid.lemonSqueezySubscriptionStatus,
      currentPeriodEnd: paid.expiresAt.toISOString(),
      portalUrl: paid.lemonSqueezyCustomerPortalUrl,
      source: "license",
    };
  }

  return {
    entitlements: entitlementsForPlan("free"),
    subscriptionLabel: "Sacred Day",
    providerSubscriptionId: sub?.providerSubscriptionId ?? null,
    status: sub?.status ?? "free",
    currentPeriodEnd: null,
    portalUrl: sub?.customerPortalUrl ?? null,
    source: "sacred_day",
  };
}
