type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const DEFAULT_MAX_PER_WINDOW = 120;
const EXTENSION_STATS_MAX = 60;

const store: Map<string, Bucket> =
  typeof globalThis !== "undefined"
    ? ((globalThis as unknown as { __hqAnalyticsRl?: Map<string, Bucket> }).__hqAnalyticsRl ??= new Map())
    : new Map();

function prune(now: number) {
  for (const [k, v] of store.entries()) {
    if (v.resetAt < now) store.delete(k);
  }
}

/** Returns true if request is allowed, false if rate limited. */
export function checkAnalyticsRateLimit(
  key: string,
  clientIp: string,
  maxPerWindow = DEFAULT_MAX_PER_WINDOW,
): boolean {
  const now = Date.now();
  prune(now);
  const rlKey = `${key}::${clientIp}`;
  const b = store.get(rlKey);
  if (!b || b.resetAt < now) {
    store.set(rlKey, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= maxPerWindow) return false;
  b.count += 1;
  return true;
}

export function checkExtensionStatsRateLimit(key: string, clientIp: string): boolean {
  return checkAnalyticsRateLimit(key, clientIp, EXTENSION_STATS_MAX);
}
