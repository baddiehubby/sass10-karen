/**
 * Request coalescing — identical in-flight / same-tick resolutions share work.
 */

export type CoalesceKeyParts = {
  userScope: string;
  userText: string;
  voice?: string;
  depth?: number;
  intentHint?: string;
};

function normalizeKey(parts: CoalesceKeyParts): string {
  const scope = (parts.userScope || "session:anon").slice(0, 64);
  const text = parts.userText.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 160);
  const voice = parts.voice ?? "warm";
  const depth = Math.min(12, Math.max(1, parts.depth ?? 1));
  const hint = parts.intentHint ?? "";
  return `${scope}|${voice}|d${depth}|${hint}|${text}`;
}

const syncHold = new Map<string, { value: unknown; until: number }>();
const asyncInflight = new Map<string, Promise<unknown>>();
const HOLD_MS = 50;
const MAX_KEYS = 64;

function pruneSync(now: number): void {
  for (const [k, v] of syncHold) {
    if (now > v.until) syncHold.delete(k);
  }
  while (syncHold.size > MAX_KEYS) {
    const first = syncHold.keys().next().value;
    if (!first) break;
    syncHold.delete(first);
  }
}

/** Sync-friendly coalesce for deterministic Soul Engine (double-submit / Strict Mode). */
export function coalesceSync<T>(parts: CoalesceKeyParts, compute: () => T): { value: T; coalesced: boolean } {
  const key = normalizeKey(parts);
  const now = Date.now();
  pruneSync(now);
  const hit = syncHold.get(key);
  if (hit && now <= hit.until) {
    return { value: hit.value as T, coalesced: true };
  }
  const value = compute();
  syncHold.set(key, { value, until: now + HOLD_MS });
  return { value, coalesced: false };
}

export async function coalesceRequest<T>(
  parts: CoalesceKeyParts,
  compute: () => T | Promise<T>,
): Promise<{ value: T; coalesced: boolean }> {
  const key = normalizeKey(parts);
  const existing = asyncInflight.get(key) as Promise<T> | undefined;
  if (existing) {
    return { value: await existing, coalesced: true };
  }
  const promise = Promise.resolve().then(() => compute());
  asyncInflight.set(key, promise);
  try {
    const value = await promise;
    return { value, coalesced: false };
  } finally {
    asyncInflight.delete(key);
  }
}

export function resetCoalesceState(): void {
  syncHold.clear();
  asyncInflight.clear();
}

export function coalesceInflightCount(): number {
  return syncHold.size + asyncInflight.size;
}
