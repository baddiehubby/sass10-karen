# Lemon Squeezy billing — production rules

**Source of truth:** signed Lemon webhooks → `Subscription` + synced `License`.  
**Never trust:** frontend state, localStorage, URL `?paid=`, cookies alone.

## Canonical API

```ts
import { getUserEntitlement } from "@/lib/billing/entitlement";

const e = await getUserEntitlement(userId);
// e.hasPaidAccess — sole paid-access boolean for product surfaces
```

## Webhook security

- Raw body HMAC-SHA256 vs `X-Signature` (`verifyLemonSignature`)
- Constant-time compare; missing secret → reject
- Errors never log secrets, API keys, or payment payloads

## Idempotency

- Unique `lemonEventId` after successful apply
- Duplicate delivery → `{ duplicate: true }`, no double grant
- Out-of-order older `updated_at` → stale ignore
- `unknown_user` / `unknown_variant` **release** the claim and return **HTTP 503** so Lemon redelivers

## Soft sync

`POST /api/billing/sync` mirrors webhook entitlement actions.  
**Cancelled ≠ immediate revoke** (cancel-at-period-end preserved).

## Live ops

See [BILLING_LIVE_OPS.md](./BILLING_LIVE_OPS.md) for the owner checklist. Checkout redirects and webhook smoke must be confirmed in Lemon test mode before calling billing “live verified.”

## Lifecycle

| Event / status | Action |
|----------------|--------|
| created / resumed / unpaused / payment_success / recovered | activate |
| payment_failed / past_due / unpaid | retain_paid (Buddie stays) |
| paused | soft_hold (access kept) |
| cancelled | cancel_at_period_end (access until `ends_at`) |
| expired / refund / chargeback | revoke entitlement only |
| order_created | ignore |
| subscription_updated + unknown status | ignore |
| unknown event | ignore |

Checkout binds `custom.user_id` from the authenticated session. Plan comes from **variant ID only**.  
Subscription `userId` is immutable after create (no cross-account hijack).

Customer portal: Lemon `customer_portal` URL stored on Subscription — no fake portal.

