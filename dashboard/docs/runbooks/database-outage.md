# Runbook: Database outage

## Symptoms
- `/api/ready` returns 503 with `database: unavailable`
- Login / dashboard / webhooks fail
- Prisma errors in host logs (message only — no connection strings)

## Immediate checks
1. Hit `GET /api/health` — if alive, process is up; dependency is DB.
2. Hit `GET /api/ready` and note `databaseLatencyMs` / outcome.
3. Check provider status page (Neon / Vercel Postgres / etc.).
4. Confirm `DATABASE_URL` not rotated unexpectedly (secrets manager).

## Mitigation
1. Wait for provider recovery or failover per provider docs.
2. Do **not** run destructive `db push` against production during incident unless planned.
3. After recovery: verify `/api/ready` 200, sample login, Lemon webhook replay if needed.

## Data loss concern
Follow `docs/POSTGRES_BACKUP.md`. DR is not verified until a restore drill is logged.
