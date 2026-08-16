# Runbook: Subscription entitlement mismatch

## Symptoms
- User paid but UI shows Sacred Day
- Portal shows active; app shows free
- Confetti / “processing” toast never clears to Premium

## Immediate checks
1. `GET /api/billing/status` (authed) — `hasPaidAccess`, `status`, `plan`.
2. Lemon subscription status for the customer.
3. Structured logs `billing.audit` for recent `lemonEventId`.
4. Confirm webhook deliveries succeeded (Lemon dashboard).

## Recovery order
1. `POST /api/billing/sync` for the user (soft sync; preserves entitlement if Lemon is flaky).
2. Replay missing webhooks.
3. Verify `Subscription` row + linked `License.plan` server-side (ops DB access).
4. Never unlock Premium via client query flags alone.

## Entitlement rules reminder
- Server / webhook gated.
- Cancel-at-period-end retains until period end.
- Unknown variants do not upgrade plans from metadata.
