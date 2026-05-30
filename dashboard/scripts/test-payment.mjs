#!/usr/bin/env node
/**
 * Lemon Squeezy payment flow validation (no real card charge).
 *
 * 1. Creates a checkout via Lemon API (Pro variant)
 * 2. Logs the checkout URL
 * 3. POSTs a mock subscription_created webhook to the local or production app
 * 4. Verifies License record in database
 *
 * Usage:
 *   node scripts/test-payment.mjs
 *   WEBHOOK_BASE_URL=https://www.buddieai.com node scripts/test-payment.mjs
 *
 * Requires: LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_PRO_VARIANT_ID, LEMONSQUEEZY_WEBHOOK_SECRET,
 *           DATABASE_URL, and TEST_USER_ID (existing user id) in .env.local
 */

import { createHmac } from "crypto";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvFile(name) {
  const path = join(root, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const API_KEY = process.env.LEMONSQUEEZY_API_KEY?.trim();
const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
const PRO_VARIANT_ID = process.env.LEMONSQUEEZY_PRO_VARIANT_ID?.trim();
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID?.trim();
const TEST_USER_ID = process.env.TEST_USER_ID?.trim();
const WEBHOOK_BASE = (process.env.WEBHOOK_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");

function sign(body) {
  return createHmac("sha256", WEBHOOK_SECRET).update(body, "utf8").digest("hex");
}

async function resolveStoreId() {
  if (STORE_ID) return STORE_ID;
  const res = await fetch("https://api.lemonsqueezy.com/v1/stores", {
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${API_KEY}`,
    },
  });
  const json = await res.json();
  return json.data?.[0]?.id || "";
}

async function createCheckout(storeId) {
  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            custom: {
              user_id: TEST_USER_ID || "test-user-id",
              tier: "pro",
            },
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: PRO_VARIANT_ID } },
        },
      },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.errors?.[0]?.detail || `Checkout HTTP ${res.status}`);
  return json.data?.attributes?.url;
}

function buildWebhookPayload(subscriptionId) {
  return {
    meta: {
      event_name: "subscription_created",
      custom_data: {
        user_id: TEST_USER_ID || "test-user-id",
        tier: "pro",
      },
    },
    data: {
      id: subscriptionId,
      attributes: {
        status: "active",
        variant_id: Number(PRO_VARIANT_ID) || PRO_VARIANT_ID,
        user_email: process.env.TEST_USER_EMAIL || "test@buddieai.com",
        renews_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  };
}

async function postWebhook(payload) {
  const body = JSON.stringify(payload);
  const res = await fetch(`${WEBHOOK_BASE}/api/lemonsqueezy/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature": sign(body),
    },
    body,
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function verifyLicenseInDb(subscriptionId) {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP  DB verify — DATABASE_URL not set");
    return null;
  }
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const license = await prisma.license.findFirst({
      where: { lemonSqueezySubscriptionId: subscriptionId },
      select: { id: true, plan: true, key: true, userId: true },
    });
    return license;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log("=== Lemon Squeezy payment test ===\n");

  const missing = [];
  if (!API_KEY) missing.push("LEMONSQUEEZY_API_KEY");
  if (!PRO_VARIANT_ID) missing.push("LEMONSQUEEZY_PRO_VARIANT_ID");
  if (!WEBHOOK_SECRET) missing.push("LEMONSQUEEZY_WEBHOOK_SECRET");

  if (missing.length) {
    console.error("FAIL  Missing env:", missing.join(", "));
    console.error("      Set these in dashboard/.env.local and re-run.");
    process.exitCode = 1;
    return;
  }

  try {
    const storeId = await resolveStoreId();
    if (!storeId) throw new Error("Could not resolve Lemon store ID");
    console.log("PASS  Store ID:", storeId);

    const checkoutUrl = await createCheckout(storeId);
    if (!checkoutUrl) throw new Error("Checkout URL missing from Lemon response");
    console.log("PASS  Checkout URL:", checkoutUrl);
    console.log("      (Open in browser to test UI — do NOT complete with a real card in CI)\n");

    const subscriptionId = `test-sub-${Date.now()}`;
    const payload = buildWebhookPayload(subscriptionId);
    const webhook = await postWebhook(payload);
    console.log(`INFO  Webhook POST ${WEBHOOK_BASE}/api/lemonsqueezy/webhook → HTTP ${webhook.status}`);
    console.log("INFO  Response:", webhook.text.slice(0, 300));

    if (webhook.status >= 200 && webhook.status < 300) {
      console.log("PASS  Webhook accepted");
    } else {
      console.error("FAIL  Webhook rejected");
      process.exitCode = 1;
    }

    const license = await verifyLicenseInDb(subscriptionId);
    if (license) {
      console.log("PASS  License in DB:", { plan: license.plan, key: license.key.slice(0, 12) + "…" });
    } else if (process.env.DATABASE_URL) {
      console.log("WARN  License not found — ensure TEST_USER_ID exists and webhook handler ran against same DB");
    }
  } catch (err) {
    console.error("FAIL ", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

main();
