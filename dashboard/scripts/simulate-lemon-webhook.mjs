#!/usr/bin/env node
/**
 * DEV ONLY — fire a correctly SIGNED Lemon Squeezy webhook at the local app, exactly
 * as Lemon would after a (test-mode) checkout. Lets you test the paywall unlock
 * without a public tunnel.
 *
 *   node scripts/simulate-lemon-webhook.mjs --user <User.id> [--event subscription_created]
 *        [--status active] [--url http://localhost:3000] [--variant <id>]
 *
 * Events: subscription_created | subscription_payment_success | subscription_cancelled
 *         | subscription_expired | order_refunded | subscription_updated ...
 *
 * Reads LEMONSQUEEZY_WEBHOOK_SECRET and LEMONSQUEEZY_KAREN_VIP_VARIANT_ID from
 * .env.local (the SAME values the running dev server must have). Refuses to run
 * against a non-local URL so it can't be pointed at production by accident.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

function parseEnvFile(file) {
  const out = {};
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      out[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    /* missing file is fine */
  }
  return out;
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const root = process.cwd();
const env = { ...parseEnvFile(path.join(root, ".env")), ...parseEnvFile(path.join(root, ".env.local")), ...process.env };

const userId = arg("user", "");
const event = arg("event", "subscription_created");
const status = arg("status", event === "subscription_cancelled" ? "cancelled" : "active");
const base = arg("url", "http://localhost:3000");
const secret = (env.LEMONSQUEEZY_WEBHOOK_SECRET || "").trim();
const variant = arg("variant", (env.LEMONSQUEEZY_KAREN_VIP_VARIANT_ID || env.LEMONSQUEEZY_PREMIUM_VARIANT_ID || "").trim());

if (!userId) {
  console.error("Missing --user <User.id>  (shown as '…xxxx' in the dev $ panel; see the User table).");
  process.exit(2);
}
if (!secret) {
  console.error("LEMONSQUEEZY_WEBHOOK_SECRET is not set (.env.local). The route fails closed without it.");
  process.exit(2);
}
if (!variant) {
  console.error("No VIP variant id: set LEMONSQUEEZY_KAREN_VIP_VARIANT_ID in .env.local or pass --variant.");
  process.exit(2);
}
const host = new URL(base).hostname;
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
  console.error(`Refusing to send to non-local host "${host}".`);
  process.exit(2);
}

const body = JSON.stringify({
  meta: { event_name: event, custom_data: { user_id: userId, product: "karen_vip" } },
  data: {
    id: `sim_${Date.now()}`,
    attributes: {
      status,
      variant_id: Number(variant) || variant,
      customer_id: `sim${userId.slice(-8)}`,
      urls: { customer_portal: "https://example.lemonsqueezy.com/billing" },
    },
  },
});
const signature = createHmac("sha256", secret).update(body, "utf8").digest("hex");

const res = await fetch(`${base.replace(/\/$/, "")}/api/webhooks/lemonsqueezy`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-signature": signature },
  body,
});
const text = await res.text();
console.log(`HTTP ${res.status}  ${text}`);
// Don't call process.exit() right after fetch (Node-on-Windows libuv assertion).
process.exitCode = res.ok ? 0 : 1;
