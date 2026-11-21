/**
 * End-to-end webhook → Prisma test for the Karen VIP paywall.
 * Drives the REAL route handler (`POST /api/webhooks/lemonsqueezy`) against a REAL
 * PostgreSQL and asserts `User.isPremium` flips — i.e. everything after "Lemon
 * calls us" except Lemon's own hosted checkout page.
 *
 * Requires:  KAREN_TEST_DATABASE_URL=postgresql://...
 * Skips (stays green) when the variable is missing.
 */
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { describe, it, before, after } from "node:test";

import { PrismaClient } from "@prisma/client";

import { resolveKarenPremium } from "@/lib/karen/vip";

const TEST_URL = process.env.KAREN_TEST_DATABASE_URL || "";
const ENABLED = Boolean(TEST_URL && !TEST_URL.includes("YOUR_VALUE"));

const SECRET = "whsec_unit_test_secret";
const VARIANT = "424242";

type Post = (req: Request) => Promise<Response>;

describe("Lemon webhook → Prisma isPremium (real route, real Postgres)", { skip: !ENABLED }, () => {
  let prisma: PrismaClient;
  let POST: Post;
  const createdIds: string[] = [];
  let userId = "";

  function payload(
    event: string,
    opts: {
      userId?: string;
      variant?: string;
      status?: string;
      customData?: unknown;
      customerId?: string;
    } = {},
  ) {
    return {
      meta: {
        event_name: event,
        custom_data: opts.customData ?? { user_id: opts.userId ?? userId, product: "karen_vip" },
      },
      data: {
        id: "sub_1",
        attributes: {
          status: opts.status ?? "active",
          variant_id: Number(opts.variant ?? VARIANT),
          customer_id: opts.customerId ?? "987654",
          urls: { customer_portal: "https://karen.lemonsqueezy.com/billing" },
        },
      },
    };
  }

  async function send(
    body: unknown,
    sign: "valid" | "bad" | "none" | { signedBody: string } = "valid",
  ) {
    const raw = JSON.stringify(body);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (sign === "valid") {
      headers["x-signature"] = createHmac("sha256", SECRET).update(raw).digest("hex");
    } else if (sign === "bad") {
      headers["x-signature"] = createHmac("sha256", "wrong-secret").update(raw).digest("hex");
    } else if (typeof sign === "object") {
      headers["x-signature"] = createHmac("sha256", SECRET).update(sign.signedBody).digest("hex");
    }
    const res = await POST(
      new Request("http://localhost/api/webhooks/lemonsqueezy", {
        method: "POST",
        headers,
        body: raw,
      }),
    );
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  }

  async function dbUser(id = userId) {
    return prisma.user.findUniqueOrThrow({ where: { id } });
  }

  before(async () => {
    // Must be set BEFORE the route (and @/lib/prisma) is imported.
    process.env.DATABASE_URL = TEST_URL;
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET;
    process.env.LEMONSQUEEZY_KAREN_VIP_VARIANT_ID = VARIANT;
    delete process.env.LEMONSQUEEZY_PREMIUM_VARIANT_ID;
    delete process.env.NEXT_PUBLIC_DEV_VIP_MODE;
    delete process.env.DEV_VIP_MODE;

    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      env: { ...process.env, DATABASE_URL: TEST_URL },
      stdio: "inherit",
      cwd: process.cwd(),
    });

    prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
    ({ POST } = (await import("../../app/api/webhooks/lemonsqueezy/route")) as { POST: Post });

    userId = `karenqa${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    createdIds.push(userId);
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.test`, password: "x" },
    });
  });

  after(async () => {
    try {
      await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("starts as a free user: paywall is ON", async () => {
    const u = await dbUser();
    assert.equal(u.isPremium, false);
    assert.equal(resolveKarenPremium(u.isPremium), false);
  });

  it("rejects bad / missing / tampered signatures and changes nothing", async () => {
    const body = payload("subscription_created");
    assert.equal((await send(body, "bad")).status, 401);
    assert.equal((await send(body, "none")).status, 401);
    // Signature was computed over a DIFFERENT body than the one delivered.
    assert.equal((await send(body, { signedBody: JSON.stringify(payload("order_paid")) })).status, 401);
    assert.equal((await dbUser()).isPremium, false);
  });

  it("ignores a valid event for a different (non-VIP) variant", async () => {
    const r = await send(payload("subscription_created", { variant: "999" }));
    assert.equal(r.status, 200);
    assert.equal(r.json.reason, "not_karen_unlock_variant");
    assert.equal((await dbUser()).isPremium, false);
  });

  it("guest and unknown users never touch the DB", async () => {
    const guest = await send(payload("subscription_created", { userId: "guest_abcdef123456" }));
    assert.equal(guest.json.guest, true);
    const unknown = await send(payload("subscription_created", { userId: "nonexistentuser1234" }));
    assert.equal(unknown.json.reason, "unknown_user");
    assert.equal((await dbUser()).isPremium, false);
  });

  it("non-activating events leave the user free (updated + cancelled status, unknown event)", async () => {
    assert.equal((await send(payload("subscription_updated", { status: "cancelled" }))).json.reason, "unhandled_event");
    assert.equal((await send(payload("license_key_created"))).json.reason, "unhandled_event");
    assert.equal((await dbUser()).isPremium, false);
  });

  it("subscription_created flips isPremium → true and stores billing ids; paywall unlocks", async () => {
    const r = await send(payload("subscription_created", { customerId: `cust${Date.now()}` }));
    assert.equal(r.status, 200);
    assert.equal(r.json.isPremium, true);
    const u = await dbUser();
    assert.equal(u.isPremium, true);
    assert.ok(u.lemonSqueezyCustomerId?.startsWith("cust"));
    assert.equal(u.karenCustomerPortalUrl, "https://karen.lemonsqueezy.com/billing");
    // What the page computes on the next refresh:
    assert.equal(resolveKarenPremium(u.isPremium), true);
  });

  it("is idempotent: replaying the same webhook keeps the user premium", async () => {
    const again = await send(payload("subscription_payment_success"));
    assert.equal(again.status, 200);
    assert.equal((await dbUser()).isPremium, true);
  });

  it("subscription_cancelled flips isPremium → false; paywall returns", async () => {
    const r = await send(payload("subscription_cancelled", { status: "cancelled" }));
    assert.equal(r.json.isPremium, false);
    const u = await dbUser();
    assert.equal(u.isPremium, false);
    assert.equal(resolveKarenPremium(u.isPremium), false);
  });

  it("subscription_updated(active) re-activates; refund revokes again", async () => {
    assert.equal((await send(payload("subscription_updated", { status: "active" }))).json.isPremium, true);
    assert.equal((await dbUser()).isPremium, true);
    assert.equal((await send(payload("order_refunded"))).json.isPremium, false);
    assert.equal((await dbUser()).isPremium, false);
  });

  it("accepts Lemon's key/value-array custom_data shape", async () => {
    const r = await send(
      payload("subscription_created", {
        customData: [{ key: "user_id", value: userId }],
        customerId: `cust-kv-${Date.now()}`,
      }),
    );
    assert.equal(r.json.isPremium, true);
    assert.equal((await dbUser()).isPremium, true);
  });
});
