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
- `unknown_user` / `unknown_variant` do **not** consume event ids (Lemon can retry)

## Lifecycle

| Event / status | Action |
|----------------|--------|
| created / resumed / unpaused / payment_success / recovered | activate |
| payment_failed / past_due | retain_paid (Buddie stays) |
| paused | soft_hold (access kept) |
| cancelled | cancel_at_period_end (access until `ends_at`) |
| expired / refund / chargeback | revoke entitlement only |
| order_created | ignore |
| unknown event | ignore |

Checkout binds `custom.user_id` from the authenticated session. Plan comes from **variant ID only**.

Customer portal: Lemon `customer_portal` URL stored on Subscription — no fake portal.
