# PostgreSQL backup & restore

**Status: NOT disaster-recovery verified.**

A backup that has never been restored is **not** a verified backup.
Do **not** claim DR readiness until a restore drill has been executed and recorded below.

## Production assumption

Buddie production uses hosted PostgreSQL (typically Neon / Vercel Postgres / equivalent).

Prefer **provider PITR** (point-in-time recovery) as the primary recovery mechanism.

## Weekly ownership checklist

1. Confirm automatic backups / PITR are enabled in the provider console.
2. Confirm retention window (document RPO target, e.g. ≤ 24h).
3. Confirm who can restore (ops owners).
4. Store restore credentials in a secrets manager — never in git.

## Logical dump (optional secondary)

```bash
# Example only — use provider connection string from secrets manager
pg_dump "$DATABASE_URL" --format=custom --file="buddie-$(date -u +%Y%m%d).dump"
```

Never paste `DATABASE_URL` into tickets, chats, or logs.

## Restore drill procedure (must be executed to verify)

1. Create an isolated restore target (new branch DB / staging project).
2. Restore from PITR timestamp **or** logical dump.
3. Run `npx prisma migrate status` (or `db push` dry verification) against restore target.
4. Smoke: `/api/ready` → 200; login; billing status for a known test account.
5. Record results in the table below.

## Restore drill log

| Date (UTC) | Operator | Method (PITR / dump) | Target | Smoke result | Notes |
|------------|----------|----------------------|--------|--------------|-------|
| — | — | — | — | **NOT RUN** | Gate cannot claim DR ready |

## RPO / RTO targets (aspirational until drill)

| Metric | Target | Verified? |
|--------|--------|-----------|
| RPO | ≤ 24 hours | No |
| RTO | ≤ 4 hours | No |

## Explicit non-claims

- App `db push` scripts are **schema apply**, not backups.
- Passing `/api/ready` proves connectivity, not restoreability.
