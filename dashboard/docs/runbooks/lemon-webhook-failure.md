# Runbook: Lemon webhook failure

## Symptoms
- Paid users stay on Sacred Day after checkout
- Logs: `billing.webhook` `invalid_signature` or `handler_failed`
- Lemon dashboard shows delivery errors / retries

## Immediate checks
1. Confirm `LEMONSQUEEZY_WEBHOOK_SECRET` matches Lemon webhook signing secret.
2. Confirm webhook URL is `https://www.buddieai.com/api/lemonsqueezy/webhook`
3. Check `/api/ready` — DB must be up for claim/apply.
4. Look for structured `billing.audit` lines with `lemonEventId` (never log raw payloads).

## Recovery
1. Fix secret / DB / deploy issue.
2. Replay failed events from Lemon dashboard (idempotent via unique `lemonEventId`).
3. Soft sync: authenticated `POST /api/billing/sync` for the affected user.
4. Confirm `GET /api/billing/status` shows `hasPaidAccess: true`.

## Do not
- Manually mint paid licenses from client/admin without audit.
- Paste webhook secrets or full JSON payloads into chat.
