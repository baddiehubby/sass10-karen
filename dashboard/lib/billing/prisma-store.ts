import { generateLicenseKey } from "@/lib/license";
import { prisma } from "@/lib/prisma";
import type { BillingStore } from "@/lib/billing/processor";
import { licensePayloadFromSubscription } from "@/lib/billing/processor";
import type { BillingSubscriptionRecord } from "@/lib/billing/types";

function mapSub(row: {
  id: string;
  userId: string;
  provider: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string;
  variantId: string | null;
  plan: string;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelledAt: Date | null;
  customerPortalUrl: string | null;
  providerUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): BillingSubscriptionRecord {
  return {
    id: row.id,
    userId: row.userId,
    provider: "lemonsqueezy",
    providerCustomerId: row.providerCustomerId,
    providerSubscriptionId: row.providerSubscriptionId,
    variantId: row.variantId,
    plan: row.plan,
    status: row.status,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelledAt: row.cancelledAt,
    customerPortalUrl: row.customerPortalUrl,
    providerUpdatedAt: row.providerUpdatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createPrismaBillingStore(): BillingStore {
  return {
    async hasProcessedEvent(eventId) {
      const row = await prisma.lemonSqueezyWebhookEvent.findUnique({
        where: { lemonEventId: eventId },
        select: { id: true },
      });
      return Boolean(row);
    },

    async claimEvent(input) {
      try {
        await prisma.lemonSqueezyWebhookEvent.create({
          data: {
            eventName: input.eventName,
            lemonEventId: input.eventId,
            payload: input.rawBody,
          },
        });
        return true;
      } catch (err) {
        const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
        if (code === "P2002") return false;
        throw err;
      }
    },

    async releaseEvent(eventId) {
      try {
        await prisma.lemonSqueezyWebhookEvent.delete({ where: { lemonEventId: eventId } });
      } catch {
        /* already gone */
      }
    },

    async recordEvent(input) {
      try {
        await prisma.lemonSqueezyWebhookEvent.update({
          where: { lemonEventId: input.eventId },
          data: {
            licenseId: input.licenseId || undefined,
            subscriptionId: input.subscriptionId || undefined,
            payload: input.rawBody,
          },
        });
      } catch {
        // Claim row may be missing in tests / legacy — best-effort create
        try {
          await prisma.lemonSqueezyWebhookEvent.create({
            data: {
              eventName: input.eventName,
              lemonEventId: input.eventId,
              payload: input.rawBody,
              licenseId: input.licenseId || undefined,
              subscriptionId: input.subscriptionId || undefined,
            },
          });
        } catch (err) {
          const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
          if (code !== "P2002") throw err;
        }
      }
    },

    async findUserIdByEmail(email) {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true },
      });
      return user?.id ?? null;
    },

    async findSubscriptionByProviderId(providerSubscriptionId) {
      const row = await prisma.subscription.findUnique({
        where: { providerSubscriptionId },
      });
      return row ? mapSub(row) : null;
    },

    async findLatestSubscriptionForUser(userId) {
      const row = await prisma.subscription.findFirst({
        where: { userId, provider: "lemonsqueezy" },
        orderBy: { updatedAt: "desc" },
      });
      return row ? mapSub(row) : null;
    },

    async upsertSubscription(input) {
      const row = await prisma.subscription.upsert({
        where: { providerSubscriptionId: input.providerSubscriptionId },
        create: {
          userId: input.userId,
          provider: "lemonsqueezy",
          providerCustomerId: input.providerCustomerId,
          providerSubscriptionId: input.providerSubscriptionId,
          variantId: input.variantId,
          plan: input.plan,
          status: input.status,
          currentPeriodStart: input.currentPeriodStart,
          currentPeriodEnd: input.currentPeriodEnd,
          cancelledAt: input.cancelledAt,
          customerPortalUrl: input.customerPortalUrl,
          providerUpdatedAt: input.providerUpdatedAt,
        },
        update: {
          // Ownership is immutable after create — never reassign via webhook custom.user_id.
          providerCustomerId: input.providerCustomerId,
          variantId: input.variantId,
          plan: input.plan,
          status: input.status,
          currentPeriodStart: input.currentPeriodStart,
          currentPeriodEnd: input.currentPeriodEnd,
          cancelledAt: input.cancelledAt,
          customerPortalUrl: input.customerPortalUrl,
          providerUpdatedAt: input.providerUpdatedAt,
        },
      });
      return mapSub(row);
    },

    async syncLicenseFromSubscription(sub) {
      const payload = licensePayloadFromSubscription(sub);
      const existing =
        (await prisma.license.findFirst({
          where: { lemonSqueezySubscriptionId: sub.providerSubscriptionId },
          select: { id: true },
        })) ||
        (await prisma.license.findFirst({
          where: { userId: sub.userId },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        }));

      if (existing) {
        await prisma.license.update({
          where: { id: existing.id },
          data: payload,
        });
        return existing.id;
      }

      const created = await prisma.license.create({
        data: {
          key: generateLicenseKey(),
          userId: sub.userId,
          ...payload,
        },
        select: { id: true },
      });
      return created.id;
    },
  };
}
