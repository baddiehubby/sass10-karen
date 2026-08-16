# BuddieAI — Lemon Squeezy LIVE OPS CHECKLIST

**Audience:** owner / operator deploying production billing.  
**Code source of truth:** signed Lemon webhooks → `Subscription` + synced `License` via `getUserEntitlement(userId)`.  
**Do not trust:** browser state, `?paid=`, `?tier=` (cosmetic only), localStorage, or client-posted plan/status/variant/order IDs.

> This checklist does **not** by itself prove live billing works. A real Lemon **test-mode** (or live) checkout + webhook delivery must be performed in your environment.

---

## 0. Preflight (Vercel / env)

- [ ] `LEMONSQUEEZY_API_KEY` set (server-only)
- [ ] `LEMONSQUEEZY_WEBHOOK_SECRET` set (matches Lemon webhook signing secret)
- [ ] `LEMONSQUEEZY_STORE_ID` set (or API can list stores)
- [ ] Variant IDs set and mapped:
  - [ ] `LEMONSQUEEZY_STARTER_VARIANT_ID`
  - [ ] `LEMONSQUEEZY_PRO_VARIANT_ID`
  - [ ] `LEMONSQUEEZY_PREMIUM_VARIANT_ID` (or Agency alias)
  - [ ] Optional: `LEMONSQUEEZY_PRO_TRIAL_VARIANT_ID`
- [ ] `DATABASE_URL` = Postgres (not SQLite)
- [ ] `NEXTAUTH_URL` / `NEXT_PUBLIC_*` = `https://www.buddieai.com`
- [ ] Prisma migrations / schema applied (`Subscription`, webhook event uniqueness)

---

## 1. Lemon dashboard configuration

- [ ] Products + variants match env IDs exactly (Starter / Pro / Premium)
- [ ] Webhook URL: `https://www.buddieai.com/api/lemonsqueezy/webhook`
- [ ] Webhook events enabled at minimum:
  - [ ] `subscription_created`
  - [ ] `subscription_updated`
  - [ ] `subscription_cancelled` / canceled
  - [ ] `subscription_resumed`
  - [ ] `subscription_expired`
  - [ ] `subscription_paused` / `subscription_unpaused`
  - [ ] `subscription_payment_success`
  - [ ] `subscription_payment_failed`
  - [ ] `subscription_payment_recovered`
  - [ ] `subscription_payment_refunded` (or refund equivalents)
  - [ ] `order_refunded`
- [ ] Signing secret copied to `LEMONSQUEEZY_WEBHOOK_SECRET`
- [ ] Test mode vs live mode clearly chosen (do not mix keys)

---

## 2. Checkout smoke (test mode preferred)

- [ ] Log in as a real test user on `https://www.buddieai.com`
- [ ] Start checkout from pricing (Starter or Pro)
- [ ] Confirm Lemon checkout opens (hosted URL)
- [ ] Confirm success redirect lands on  
  `https://www.buddieai.com/dashboard?payment=success&tier=…`  
  (www only — not apex, not preview host)
- [ ] Cancel / abandon path returns to pricing without granting access
- [ ] Complete a **test-mode** payment with Lemon test card

---

## 3. Webhook delivery verification

- [ ] Lemon webhook delivery log shows **2xx** for successful apply (or **503** only while waiting for user/variant fix, then success on retry)
- [ ] Invalid signature attempts return **401** (spot-check with wrong secret in staging only)
- [ ] Duplicate delivery of the same event does **not** double-upgrade plan
- [ ] After payment, `Subscription` row exists for the user with:
  - [ ] Correct `providerSubscriptionId`
  - [ ] Correct `plan` (from variant, not custom `tier`)
  - [ ] `status` active / on_trial
  - [ ] `currentPeriodEnd` populated
- [ ] `License` for that user shows paid plan + Lemon status
- [ ] `GET /api/billing/status` (authenticated as that user) shows `hasPaidAccess: true`

---

## 4. Lifecycle matrix (perform each once in test mode)

| Scenario | How | Expected |
|----------|-----|----------|
| FREE → PAID | Test checkout | Paid entitlement; memories retained |
| PAID → CANCELLED | Cancel in Lemon / portal | Plan stays paid until period end; label “Cancels at period end” |
| Soft sync after cancel | `POST /api/billing/sync` as that user | Must **not** immediately demote to free |
| PAID → EXPIRED | Wait / force expire in Lemon | Access revoked; account + memories remain |
| PAID → REFUNDED | Issue refund in Lemon | Entitlement revoked; user account not deleted |
| FAILED PAYMENT | Simulate failed renewal | `past_due` / retain access until expired |
| RESUBSCRIBE / resume | Resume or new checkout | Access restored (`active`) |
| DUPLICATE webhook | Resend same event in Lemon UI | Harmless `{ duplicate: true }` |
| OUT-OF-ORDER | Older `updated_at` after newer | Stale ignore; state unchanged |
| UNKNOWN EVENT | N/A / ignore | No entitlement change |
| INVALID SIGNATURE | Wrong secret (staging) | 401; no DB write |

---

## 5. Abuse / trust checks

- [ ] Logged-in User A cannot unlock Pro by visiting `?payment=success&tier=premium` alone
- [ ] User A cannot POST fake `paid=true` / plan / variant / order id to any API to gain access
- [ ] User B cannot attach User A’s Lemon subscription id via crafted webhook custom data (ownership immutable after create)
- [ ] `/api/licenses/generate` still refuses paid mint (410)

---

## 6. Reactivation & data integrity

- [ ] After cancel-at-period-end, Buddy memories / settings still present
- [ ] After refund/expire, memories still present (entitlement only revoked)
- [ ] Resume / new paid checkout restores paid plan without wiping account

---

## 7. Monitoring (ongoing)

- [ ] Alert on webhook **5xx** spike
- [ ] Alert on sustained **503** `unknown_variant` (env mismatch)
- [ ] Weekly: spot-check one paid user entitlement vs Lemon portal
- [ ] After any variant ID change: update Vercel env **before** selling that SKU

---

## Explicit non-claims

- Automated CI tests cover processor / signature / idempotency / ownership / redirect canonicalization.  
- **Live or sandbox money movement is only verified when you complete section 2–4 above** in your Lemon store.
