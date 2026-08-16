/**
 * User-scoped deterministic reply cache.
 * Never puts private / memory-cited replies into shared or global caches.
 */

import { hash, normalizeWording } from "@/src/intelligence/variation";
import type { BuddyIntent, CharacterVoice } from "@/src/intelligence/types";

export type CachedReply = {
  text: string;
  intent: BuddyIntent;
  familyId: string;
  emotion: string;
  createdAt: number;
};

type CacheBucket = Map<string, CachedReply>;

/** Per-user buckets only — no shared cross-user store. */
const userBuckets = new Map<string, CacheBucket>();

const MAX_ENTRIES_PER_USER = 48;
const TTL_MS = 1000 * 60 * 30; // 30 minutes

export function buildUserCacheKey(input: {
  userScope: string;
  intent: BuddyIntent;
  userText: string;
  voice: CharacterVoice;
  depth: number;
}): string {
  const scope = sanitizeScope(input.userScope);
  const norm = normalizeWording(input.userText).slice(0, 120);
  const depthBucket = Math.min(3, Math.max(1, Math.floor(input.depth)));
  return `${scope}|${input.intent}|${input.voice}|d${depthBucket}|${hash(norm)}`;
}

function sanitizeScope(scope: string): string {
  const s = scope.trim().slice(0, 64) || "anon";
  // Never allow a bare "global" / "shared" scope to leak across users
  if (s === "global" || s === "shared" || s === "*") return `user:${hash(s)}`;
  return s.startsWith("user:") || s.startsWith("session:") ? s : `user:${s}`;
}

export function getDeterministicCache(key: string, userScope: string): CachedReply | null {
  const bucket = userBuckets.get(sanitizeScope(userScope));
  if (!bucket) return null;
  const hit = bucket.get(key);
  if (!hit) return null;
  if (Date.now() - hit.createdAt > TTL_MS) {
    bucket.delete(key);
    return null;
  }
  return hit;
}

export function setDeterministicCache(key: string, userScope: string, value: Omit<CachedReply, "createdAt">): void {
  const scope = sanitizeScope(userScope);
  let bucket = userBuckets.get(scope);
  if (!bucket) {
    bucket = new Map();
    userBuckets.set(scope, bucket);
  }
  bucket.set(key, { ...value, createdAt: Date.now() });
  if (bucket.size > MAX_ENTRIES_PER_USER) {
    const first = bucket.keys().next().value;
    if (first) bucket.delete(first);
  }
}

/** Test / logout helper — clears one user or all. */
export function clearDeterministicCache(userScope?: string): void {
  if (!userScope) {
    userBuckets.clear();
    return;
  }
  userBuckets.delete(sanitizeScope(userScope));
}

export function deterministicCacheStats(): { users: number; entries: number } {
  let entries = 0;
  for (const b of userBuckets.values()) entries += b.size;
  return { users: userBuckets.size, entries };
}
