/**
 * Safe client storage with graceful in-memory session mode.
 * Private browsing / quota / Safari ITP failures never throw to the UI.
 */

export type ClientStorageMode = "persistent" | "memory";

const memoryStore = new Map<string, string>();
let mode: ClientStorageMode = "persistent";
let probed = false;

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function getLocalStorage(): StorageLike | null {
  try {
    if (typeof globalThis === "undefined") return null;
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

function probePersistentStorage(): ClientStorageMode {
  const ls = getLocalStorage();
  if (!ls) return "memory";
  try {
    const key = "__buddie_storage_probe__";
    ls.setItem(key, "1");
    ls.removeItem(key);
    return "persistent";
  } catch {
    return "memory";
  }
}

export function getClientStorageMode(): ClientStorageMode {
  if (!probed) {
    mode = probePersistentStorage();
    probed = true;
  }
  return mode;
}

/** True when this session cannot rely on localStorage/IndexedDB writes. */
export function isMemorySessionMode(): boolean {
  return getClientStorageMode() === "memory";
}

export function safeGetItem(key: string): string | null {
  if (getClientStorageMode() === "memory") {
    return memoryStore.has(key) ? memoryStore.get(key)! : null;
  }
  const ls = getLocalStorage();
  if (!ls) {
    mode = "memory";
    return memoryStore.has(key) ? memoryStore.get(key)! : null;
  }
  try {
    return ls.getItem(key);
  } catch {
    mode = "memory";
    return memoryStore.has(key) ? memoryStore.get(key)! : null;
  }
}

/** Returns false when the write stayed in memory only (still usable this session). */
export function safeSetItem(key: string, value: string): boolean {
  if (getClientStorageMode() === "memory") {
    memoryStore.set(key, value);
    return false;
  }
  const ls = getLocalStorage();
  if (!ls) {
    mode = "memory";
    memoryStore.set(key, value);
    return false;
  }
  try {
    ls.setItem(key, value);
    return true;
  } catch {
    mode = "memory";
    memoryStore.set(key, value);
    return false;
  }
}

export function safeRemoveItem(key: string): void {
  memoryStore.delete(key);
  if (getClientStorageMode() === "memory") return;
  const ls = getLocalStorage();
  if (!ls) {
    mode = "memory";
    return;
  }
  try {
    ls.removeItem(key);
  } catch {
    mode = "memory";
  }
}

/** Best-effort IndexedDB open — never throws; null when unavailable. */
export async function tryOpenIndexedDb(name: string, version = 1): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open(name, version);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        /* callers create stores as needed */
      };
    });
  } catch {
    return null;
  }
}

/** Reset for tests only. */
export function resetClientStorageForTests(): void {
  memoryStore.clear();
  mode = "persistent";
  probed = false;
}
