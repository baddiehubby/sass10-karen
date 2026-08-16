import { randomBytes } from "crypto";
import type { BillingStore } from "@/lib/billing/processor";
import { licensePayloadFromSubscription } from "@/lib/billing/processor";
import type { BillingSubscriptionRecord } from "@/lib/billing/types";

/** In-memory billing store for deterministic unit tests. */
export function createMemoryBillingStore(seed?: {
  users?: Array<{ id: string; email: string }>;
}): BillingStore & {
  subscriptions: Map<string, BillingSubscriptionRecord>;
  events: Set<string>;
  licenses: Map<string, { userId: string; plan: string; status: string; expiresAt: Date }>;
} {
  const users = new Map((seed?.users ?? []).map((u) => [u.email.toLowerCase(), u.id]));
  const subscriptions = new Map<string, BillingSubscriptionRecord>();
  const events = new Set<string>();
  const licenses = new Map<string, { userId: string; plan: string; status: string; expiresAt: Date }>();
  const eventRows: string[] = [];

  const store: BillingStore & {
    subscriptions: typeof subscriptions;
    events: typeof events;
    licenses: typeof licenses;
  } = {
    subscriptions,
    events,
    licenses,

    async hasProcessedEvent(eventId) {
      return events.has(eventId);
    },

    async claimEvent(input) {
      if (events.has(input.eventId)) return false;
      events.add(input.eventId);
      eventRows.push(input.eventId);
      return true;
    },

    async releaseEvent(eventId) {
      events.delete(eventId);
    },

    async recordEvent(input) {
      events.add(input.eventId);
      if (!eventRows.includes(input.eventId)) eventRows.push(input.eventId);
    },

    async findUserIdByEmail(email) {
      return users.get(email.toLowerCase()) ?? null;
    },

    async findSubscriptionByProviderId(providerSubscriptionId) {
      return subscriptions.get(providerSubscriptionId) ?? null;
    },

    async upsertSubscription(input) {
      const prev = subscriptions.get(input.providerSubscriptionId);
      const now = new Date();
      const row: BillingSubscriptionRecord = {
        id: prev?.id ?? `sub_${randomBytes(6).toString("hex")}`,
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
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      };
      subscriptions.set(input.providerSubscriptionId, row);
      return row;
    },

    async syncLicenseFromSubscription(sub) {
      const payload = licensePayloadFromSubscription(sub);
      licenses.set(sub.userId, {
        userId: sub.userId,
        plan: payload.plan,
        status: payload.lemonSqueezySubscriptionStatus,
        expiresAt: payload.expiresAt,
      });
      return `lic_${sub.userId}`;
    },
  };

  return store;
}
