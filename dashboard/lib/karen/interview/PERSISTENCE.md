# Karen persistence (Stage 6B-1 / 6B-1.1)

## Schema changes (additive)

| Model | Purpose |
|---|---|
| `KarenInterview` | 1:1 with `User`; JSON `payload` = full `KarenInterviewState`; `version` for optimistic concurrency |
| `KarenProcessedAnswer` | `@@unique([userId, fingerprint])` for cross-restart answer/verdict idempotency |

Buddy models (`BuddyBond`, `MemoryFragment`, …) are untouched.

## Migration instructions (not applied by this stage)

1. Review `prisma/proposed-migrations/add_karen_interview_persistence.sql`.
2. Apply on a staging DB first (SQL file is `IF NOT EXISTS` safe).
3. Regenerate client: `npx prisma generate`.
4. Optionally later: baseline into Prisma Migrate per `prisma/MIGRATION_PLAN.md`.

Do **not** run `prisma migrate deploy` as the first migration on production without a baseline (same constraint as Buddy Soul).

Local/dev alternative after review: `pnpm db:push` / `npm run db:push` (creates tables from `schema.prisma`).

## Application wiring

```ts
import { resolveAuthedKarenStore } from "@/lib/karen/interview/prisma-store";
import { createKarenOrchestrator } from "@/lib/karen/interview/orchestrator";

const scoped = await resolveAuthedKarenStore(); // uses sessionUserId()
if (!scoped) throw new Error("unauthenticated");
const karen = createKarenOrchestrator({
  store: scoped.store,
  userId: scoped.userId,
});
```

`createAuthedKarenSessionStore` rejects cross-user get/set. Never pass a client-supplied userId into the store as ownership.

Transaction / auth / SQL audit details: `STAGE_6B_1_1_AUDIT.md`.

## Pre-production rollback (no Karen user data)

Use **only** when Karen tables were never written with real settler data (dev/staging before launch).

1. Stop deploying any code that imports `createPrismaKarenSessionStore` / `resolveAuthedKarenStore`.
2. Drop empty (or disposable) tables:

```sql
DROP TABLE IF EXISTS "KarenProcessedAnswer";
DROP TABLE IF EXISTS "KarenInterview";
```

3. Remove the two models from `schema.prisma` and run `npx prisma generate`.
4. Buddy tables remain intact.

No backup required when you are certain zero production Karen rows exist (`SELECT COUNT(*) FROM "KarenInterview"` → 0).

## Post-production recovery

When Karen user data may exist, **never** drop tables first. Follow `DATA_DELETION.md` → “Post-production schema recovery”.

## Privacy

See `DATA_DELETION.md` for account/data deletion and logging guidance.
