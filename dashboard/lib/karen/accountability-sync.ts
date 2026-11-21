/**
 * Goal Tracker → Prisma sync outcome, safe to send to the browser.
 * Raw Prisma errors can contain hostnames / connection strings, so the server
 * action logs the real error and returns only one of these reasons.
 */
export type AccountabilitySyncReason =
  | "not_migrated" // karenAccountabilityJson column/table missing → run the migration
  | "db_unreachable" // Postgres down / bad DATABASE_URL / auth failure / timeout
  | "unknown";

export type AccountabilitySyncResult =
  | { ok: true }
  | { ok: false; reason: AccountabilitySyncReason; error: string };

const NOT_MIGRATED_CODES = new Set(["P2021", "P2022"]);
const UNREACHABLE_CODES = new Set(["P1000", "P1001", "P1002", "P1003", "P1008", "P1017"]);

export function classifyAccountabilitySyncError(err: unknown): AccountabilitySyncReason {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === "string") {
    if (NOT_MIGRATED_CODES.has(code)) return "not_migrated";
    if (UNREACHABLE_CODES.has(code)) return "db_unreachable";
  }
  const name = (err as { name?: unknown } | null)?.name;
  const msg = err instanceof Error ? err.message : "";
  if (
    /does not exist in the current database|column .* does not exist|karenAccountabilityJson/i.test(
      msg,
    )
  ) {
    return "not_migrated";
  }
  if (
    name === "PrismaClientInitializationError" ||
    /can't reach database server|environment variable not found|connection refused|ECONNREFUSED/i.test(
      msg,
    )
  ) {
    return "db_unreachable";
  }
  return "unknown";
}

export function accountabilitySyncFailure(
  reason: AccountabilitySyncReason,
): Extract<AccountabilitySyncResult, { ok: false }> {
  const error =
    reason === "not_migrated"
      ? "Account sync isn't set up yet (database needs the latest migration)."
      : reason === "db_unreachable"
        ? "Couldn't reach the database right now."
        : "Account sync failed.";
  return { ok: false, reason, error };
}

/** One-line status the dashboard shows after a save. */
export function accountabilitySyncNote(
  result: AccountabilitySyncResult | "guest",
): string {
  if (result === "guest") return "Saved on this device only.";
  if (result.ok) return "Synced to your account.";
  return `Saved on this device only — ${result.error}`;
}
