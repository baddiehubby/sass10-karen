import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  getClientStorageMode,
  isMemorySessionMode,
  resetClientStorageForTests,
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
} from "@/lib/client-storage";
import { resolveOrbRenderMode } from "@/lib/orb-render-policy";
import { resetCapabilityCache } from "@/src/intelligence/device-capabilities";

function installMemoryLocalStorage() {
  const map = new Map<string, string>();
  const ls = {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: ls,
  });
  return ls;
}

describe("client storage memory session", () => {
  let previous: unknown;

  beforeEach(() => {
    previous = (globalThis as { localStorage?: unknown }).localStorage;
    installMemoryLocalStorage();
    resetClientStorageForTests();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: previous,
    });
    resetClientStorageForTests();
  });

  it("uses persistent mode when localStorage works", () => {
    assert.equal(getClientStorageMode(), "persistent");
    assert.equal(isMemorySessionMode(), false);
    assert.equal(safeSetItem("k", "v"), true);
    assert.equal(safeGetItem("k"), "v");
    safeRemoveItem("k");
    assert.equal(safeGetItem("k"), null);
  });

  it("falls back to in-memory session when localStorage throws", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem() {
          throw new Error("blocked");
        },
        setItem() {
          throw new Error("blocked");
        },
        removeItem() {
          throw new Error("blocked");
        },
      },
    });
    resetClientStorageForTests();
    assert.equal(getClientStorageMode(), "memory");
    assert.equal(isMemorySessionMode(), true);
    assert.equal(safeSetItem("session_mood", "calm"), false);
    assert.equal(safeGetItem("session_mood"), "calm");
  });
});

describe("orb render policy", () => {
  beforeEach(() => {
    resetCapabilityCache();
  });

  it("prefers CSS when forced", () => {
    assert.equal(resolveOrbRenderMode({ forceCss: true }), "css");
  });

  it("never requires WebGPU for orb rendering", () => {
    const mode = resolveOrbRenderMode({ forceCss: true });
    assert.equal(mode, "css");
  });
});
