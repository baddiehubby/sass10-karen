# Stage 6B-1.1 — Persistence verification audit

Do not apply migrations to production from this document. No Stage 6B-2 work.

## 1. Transaction audit (Prisma implementation)

Source: `lib/karen/interview/prisma-store.ts` → `writeInterviewPayload` / `claimFingerprint`.

| Claim | Proof |
|---|---|
| Fingerprint insert + interview update are atomic | Both run inside one `db.$transaction(..., { isolationLevel: RepeatableRead })`. Any thrown error (including `KarenConcurrentWriteError`) aborts the transaction; PostgreSQL rolls back interview + fingerprint writes together. |
| Version comparison cannot silently overwrite | Updates use `updateMany({ where: { userId, version: expected } })`. `count !== 1` → `KarenConcurrentWriteError` → transaction rollback. Create races use insert + P2002 fallback to the same versioned `updateMany` (never blind upsert overwrite). |
| Unique constraints handle races | `KarenInterview.userId` unique + `KarenProcessedAnswer (userId, fingerprint)` unique. Create races catch P2002. Fingerprint claims catch P2002 and treat as idempotent success. |
| Failed transactions leave no partial rows | Unit: forced mid-tx failure restores prior maps. PG suite: forced throw after `updateMany` leaves version/payload unchanged and fingerprint absent. |

Isolation: `Prisma.TransactionIsolationLevel.RepeatableRead` (PostgreSQL).

## 2. Authentication audit

| Path | Identity source | Client userId ownership? |
|---|---|---|
| `resolveAuthedKarenStore()` | `sessionUserId()` (server session) | No — returns null if unauthenticated |
| `createAuthedKarenSessionStore(id)` | Caller must pass verified session id | Rejects mismatched `get`/`set` |
| `createPrismaKarenSessionStore()` | Accepts `state.userId` / arg | **Must not** be used by request handlers bare; contract `KAREN_PRODUCTION_AUTH_CONTRACT` documents this |
| `deleteKarenDataForUser` | Caller-supplied id | Intended for GDPR/admin after auth checks (no API wired in 6B-1) |

Grep (6B-1.1): no app route / API handler imports the bare Prisma store. Only tests + `prisma-store.ts` itself. `asState` overwrites payload `userId` with the scoped argument so JSON spoofing cannot change ownership on read.

**Finding:** Production read/write ownership is correctly designed around session identity. Stage 6B-2 must wire APIs exclusively through `resolveAuthedKarenStore` / `createAuthedKarenSessionStore`.

## 3. Migration audit (SQL vs Prisma schema)

Compared `prisma/proposed-migrations/add_karen_interview_persistence.sql` to `KarenInterview` / `KarenProcessedAnswer` in `schema.prisma`.

| Check | Result |
|---|---|
| Table names | Match (`KarenInterview`, `KarenProcessedAnswer`) |
| Columns | Match (`id`, `userId`, `version`, `payload`, timestamps; processed: `id`, `userId`, `interviewId`, `fingerprint`, `createdAt`) |
| FK User → Interview | `ON DELETE CASCADE` — matches Prisma |
| FK Interview → ProcessedAnswer | `ON DELETE CASCADE` — matches Prisma |
| Unique `userId` on interview | Unique index — matches |
| Unique `(userId, fingerprint)` | Unique index — matches |
| Indexes `updatedAt`, `(userId, createdAt)` | Present — matches |
| JSON | SQL `JSONB` — correct for Prisma `Json` on PostgreSQL |
| `updatedAt` DEFAULT | **Fixed in 6B-1.1** — `DEFAULT CURRENT_TIMESTAMP` (was NOT NULL without default; raw INSERT would fail) |
| Buddy tables touched? | No — additive only |
| Safe on existing Buddy DB? | Yes, if `User` exists (FK target). `IF NOT EXISTS` / constraint guards make re-runs safe. Does not alter Buddy Soul / MemoryFragment. |
| Prisma Migrate history | Still none — same constraint as Buddy Soul (`MIGRATION_PLAN.md`). Prefer proposed SQL or reviewed `db push` on staging; do not `migrate deploy` as first migration on production. |

**Not applied to production.**

## 4. Rollback & data deletion

See `PERSISTENCE.md` (pre-production rollback) and `DATA_DELETION.md` (post-production recovery + user deletion). Two separate procedures — do not conflate them.

## 5. PostgreSQL test gate

Suite: `lib/karen/interview/prisma-store.pg.test.ts`  
Optional DB: `docker-compose.karen-test.yml` → `KAREN_TEST_DATABASE_URL=postgresql://karen:karen@127.0.0.1:55432/karen_test`

When the env var is unset, PG cases skip. Live results must be recorded before production go.

### Runbook (when Docker/Postgres available)

```bash
docker compose -f docker-compose.karen-test.yml up -d
# wait for healthy
set KAREN_TEST_DATABASE_URL=postgresql://karen:karen@127.0.0.1:55432/karen_test
npx tsx --test lib/karen/interview/prisma-store.pg.test.ts
```

### Results captured in this environment (2026-11-15)

| Suite | Result |
|---|---|
| `lib/karen/interview/*.test.ts` unit (incl. fake-Prisma store) | **80 pass / 0 fail** |
| Live PostgreSQL integration (`prisma-store.pg.test.ts`) | **SKIPPED** — no Docker, no local Postgres on :5432/:55432, no `KAREN_TEST_DATABASE_URL`, no `.env` |

## 6. Go / no-go

**NO-GO for production persistence deploy** until live PG integration suite passes against a real test database.

**GO for Stage 6B-1.1 completion as verification package**: store hardened (create+P2002, RepeatableRead, auth contract), SQL aligned, rollback/deletion procedures documented, gated PG tests ready.

Do not start Stage 6B-2 from this report alone if production write paths are intended without the live PG green run.
