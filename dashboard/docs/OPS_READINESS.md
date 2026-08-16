# Operations readiness

Production SaaS must be **recoverable**, not merely buildable.

## Implemented controls

| Control | Location |
|---------|----------|
| Structured JSON logging | `lib/ops/logger.ts` |
| Request correlation IDs | middleware `x-request-id` + `lib/ops/request-id.ts` |
| Safe error reporting | Sentry `beforeSend` scrub (`lib/ops/sentry-scrub.ts`) |
| Webhook event IDs | `LemonSqueezyWebhookEvent.lemonEventId` unique + billing audit logs |
| Billing audit trail | DB webhook rows + `event: billing.audit` structured logs |
| Auth failure telemetry | `event: auth.failure` reason codes only |
| Critical API latency | `observeApiRoute` / `event: http.request` |
| Health | `GET /api/health` |
| Readiness | `GET /api/ready` (env soft-check in prod + `SELECT 1`) |
| DB connectivity | `lib/ops/db-health.ts` |
| Error boundaries | `app/error.tsx`, `app/dashboard/error.tsx`, `app/global-error.tsx` |

## Never log

passwords · OAuth secrets · API keys · webhook secrets · session tokens · full Authorization headers · payment secrets · private user content

## Runbooks

See `docs/runbooks/`.

## Disaster recovery

See `docs/POSTGRES_BACKUP.md`.

**DR is NOT claimed ready** until a restore drill is recorded there.
