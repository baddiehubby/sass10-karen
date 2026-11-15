# Karen data deletion & privacy

Karen interviewer data is stored separately from Buddy’s `MemoryFragment` / `BuddyBond` records.

## What is stored

| Table | Contents |
|---|---|
| `KarenInterview` | Per-user interview payload (promises, goals, excuses, facts, probe bank, ladder, mood, turns, scorecard, idempotency fields) |
| `KarenProcessedAnswer` | Answer fingerprints for cross-restart duplicate suppression |

User identity comes only from the verified server session (`sessionUserId()`). Client-supplied `userId` values are never trusted for ownership.

## Account / Karen-data deletion request

When a user requests account or Karen-data deletion, remove only their rows:

```sql
-- Order: children first if FKs are not cascading in a given environment.
DELETE FROM "KarenProcessedAnswer" WHERE "userId" = $1;
DELETE FROM "KarenInterview" WHERE "userId" = $1;
```

With the Prisma schema’s `onDelete: Cascade` on `User` → `KarenInterview` → `KarenProcessedAnswer`, deleting the `User` row also removes Karen data.

Application helper (when wired to an admin/GDPR path):

```ts
import { deleteKarenDataForUser } from "@/lib/karen/interview/prisma-store";
await deleteKarenDataForUser(userId);
```

This does **not** delete Buddy `MemoryFragment` rows. Call Buddy deletion paths separately if required.

## Post-production schema recovery (preserve user data)

Use when Karen tables already hold real settler data and you must roll back schema or recover from a bad deploy. **Separate from** pre-production empty-table drop in `PERSISTENCE.md`.

1. **Freeze writes** — undeploy / feature-flag off all Karen persistence callers.
2. **Backup before any destructive DDL**:

```bash
# Example — adjust connection string and filenames.
pg_dump "$DATABASE_URL" \
  --table='"KarenInterview"' \
  --table='"KarenProcessedAnswer"' \
  --data-only \
  --format=custom \
  -f karen_export_$(date +%Y%m%d).dump
```

Optional JSON export for application-level restore:

```sql
COPY (SELECT * FROM "KarenInterview") TO STDOUT WITH (FORMAT csv, HEADER true);
COPY (SELECT * FROM "KarenProcessedAnswer") TO STDOUT WITH (FORMAT csv, HEADER true);
```

3. **Verify backup** (row counts match live; restore into a scratch DB).
4. Only then consider schema rollback:

```sql
DROP TABLE IF EXISTS "KarenProcessedAnswer";
DROP TABLE IF EXISTS "KarenInterview";
```

5. To restore later: recreate tables from `add_karen_interview_persistence.sql`, then `pg_restore` / `COPY` the export.
6. Buddy data is never modified by these steps.

## Logging

Production stores must not log raw conversation turns, excuse text, or fact payloads at info level. Prefer userId + fingerprint hashes / question ids only when debugging.

## Verified facts

Storage never upgrades a user utterance into a `verified_fact`. Classification remains in the deterministic engines; the store persists whatever the orchestrator already computed.
