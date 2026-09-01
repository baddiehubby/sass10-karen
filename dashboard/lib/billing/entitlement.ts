/**

 * Server-side entitlement from Subscription (preferred) with License fallback.

 * Never trust client paid flags, URL params, or localStorage.

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

  plan: string;

};



/**

 * Canonical entitlement API for the whole application.

 * Use this instead of ad-hoc License.plan checks in pages/components.

 */

export type UserEntitlement = {

  userId: string;

  /** True when the user currently has paid Buddie features. */

  hasPaidAccess: boolean;

  plan: string;

  status: string | null;

  currentPeriodEnd: string | null;

  portalUrl: string | null;

  subscriptionLabel: string;

  entitlements: LivingBuddyEntitlements;

  source: ServerBillingSnapshot["source"];

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

      plan: sub.plan,

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

      plan: paid.plan,

    };

  }



  return {

    entitlements: entitlementsForPlan("free"),

    subscriptionLabel: "Sacred Day",

    providerSubscriptionId: sub?.providerSubscriptionId ?? null,

    status: sub?.status ?? "free",

    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,

    portalUrl: sub?.customerPortalUrl ?? null,

    source: "sacred_day",

    plan: "free",

  };

}



/** Canonical server-side entitlement check — sole source of paid access truth. */

export async function getUserEntitlement(userId: string): Promise<UserEntitlement> {

  const snapshot = await getServerBillingSnapshot(userId);

  return {

    userId,

    hasPaidAccess: !snapshot.entitlements.requiresSubscription,

    plan: snapshot.plan,

    status: snapshot.status,

    currentPeriodEnd: snapshot.currentPeriodEnd,

    portalUrl: snapshot.portalUrl,

    subscriptionLabel: snapshot.subscriptionLabel,

    entitlements: snapshot.entitlements,

    source: snapshot.source,

  };

}


