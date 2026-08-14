# Buddy Soul Engine — database migration plan

This file is a **plan**. It is not an applied Prisma migration.

Do **not** run `prisma db push`, `prisma migrate dev`, or `prisma migrate deploy` until this plan is reviewed.

## Why migrate deploy cannot be step 0 today

- `dashboard/prisma/migrations/` **does not exist**.
- Production was evolved with `prisma db push` (see `package.json` script `db:push`).
- `npx prisma migrate deploy` with an empty migrations folder will not add `User.eidataConsentCompleted`.
- Making `add_buddy_soul_engine` the **first** migration would emit `CREATE TABLE` for the entire app schema and **fail** on production (tables already exist).

## Production auth issue (separate from Soul Engine)

Prisma P2022: `User.eidataConsentCompleted` is in `schema.prisma` but missing on production Postgres.

That column must be added **before** any Soul Engine tables are required at runtime.

Proposed SQL (review only — not executed here):

```sql
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "eidataConsentCompleted" BOOLEAN NOT NULL DEFAULT false;
```

Safer than a full `db push` (push can create other models that may not exist in prod yet: `UserConsent`, `CompanionPresence`, `PushSubscription`, `AnonymizedMoodEvent`, …).

## Recommended Prisma sequence (after approval)

1. **Baseline** the existing production schema into Prisma Migrate without applying it:
   - Create a baseline migration that matches current production.
   - On production: `prisma migrate resolve --applied "<baseline_name>"`.
2. **Migration A** (additive only): add `eidataConsentCompleted` if not present.
3. **Migration B** (additive only): create `BuddyBond`, `MemoryFragment`, `UnlockedAura`, `DailyRitual`.
4. Deploy app code that already **falls back** if Soul tables are missing (P2021/P2022).
5. Then `migrate deploy` on production.

Until A+B are applied, the Soul Engine APIs return `{ available: false }` and the local Buddy Universe (device identity) keeps working.

## Soul tables (additive)

- `BuddyBond` (1:1 User)
- `MemoryFragment`
- `UnlockedAura`
- `DailyRitual` (`ritualDate` is `@db.Date` so uniqueness is per calendar day)

No drops. No column removals. `bondDepth` is internal and must never be rendered.
