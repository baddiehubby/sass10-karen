/**
 * Cross-device premium experience — capability routing matrix.
 * Same Buddie character on every surface; paths differ internally only.
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import { resolveOrbRenderMode } from "@/lib/orb-render-policy";
import { buddyReplyToText } from "@/lib/buddy-intelligence";
import {
  getAdaptiveRuntime,
  resetAdaptiveRuntime,
  applyAdaptiveEnrichment,
} from "@/src/intelligence/adaptive/runtime";
import {
  detectCapabilityProfile,
  resetCapabilityCache,
  resolveIntelligenceStrategy,
} from "@/src/intelligence/device-capabilities";

const FORBIDDEN_USER_COPY =
  /WebGPU unsupported|iPhone unsupported|Safari unsupported|Download 2GB|Configure API|API key required|Provider unavailable|Model unavailable|iPhone mode|Android mode|composed_local|full_local|optionalTiny|WASM unsupported/i;

type NavStub = {
  userAgent: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  maxTouchPoints?: number;
  gpu?: { requestAdapter: () => Promise<unknown> };
  connection?: { saveData?: boolean; effectiveType?: string };
};

function withEnv(nav: NavStub, run: () => void) {
  const prevNav = (globalThis as { navigator?: unknown }).navigator;
  const prevWin = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: {
      ...nav,
      serviceWorker: {},
      onLine: true,
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      matchMedia: (q: string) => ({
        matches: /prefers-reduced-motion:\s*reduce/i.test(q)
          ? false
          : /max-width|pointer:\s*coarse/i.test(q) && /iphone|android|mobile/i.test(nav.userAgent),
        media: q,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        onchange: null,
        dispatchEvent() {
          return false;
        },
      }),
    },
  });
  (globalThis as { indexedDB?: unknown }).indexedDB = {};
  (globalThis as { WebAssembly?: unknown }).WebAssembly = {};
  try {
    resetCapabilityCache();
    resetAdaptiveRuntime();
    run();
  } finally {
    Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: prevNav });
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: prevWin });
    resetCapabilityCache();
    resetAdaptiveRuntime();
  }
}

const SURFACES = [
  {
    id: "iphone-safari",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    expectOrb: "css" as const,
    expectSoul: true,
    expectReady: true,
    expectShortForcedByMissingGpu: false,
  },
  {
    id: "iphone-pwa-webkit",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    expectOrb: "css" as const,
    expectSoul: true,
    expectReady: true,
    expectShortForcedByMissingGpu: false,
  },
  {
    id: "android-chrome",
    ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    expectOrb: "css" as const,
    expectSoul: true,
    expectReady: true,
    expectShortForcedByMissingGpu: false,
  },
  {
    id: "desktop-chrome",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    expectOrb: "css" as const, // no WebGL stub in test env → css
    expectSoul: true,
    expectReady: true,
    expectShortForcedByMissingGpu: false,
    hardwareConcurrency: 8,
    deviceMemory: 8,
  },
  {
    id: "desktop-edge",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    expectOrb: "css" as const,
    expectSoul: true,
    expectReady: true,
    expectShortForcedByMissingGpu: false,
    hardwareConcurrency: 8,
    deviceMemory: 8,
  },
  {
    id: "desktop-safari",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    expectOrb: "css" as const,
    expectSoul: true,
    expectReady: true,
    expectShortForcedByMissingGpu: false,
  },
  {
    id: "firefox-desktop",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    expectOrb: "css" as const,
    expectSoul: true,
    expectReady: true,
    expectShortForcedByMissingGpu: false,
    hardwareConcurrency: 8,
  },
] as const;

describe("cross-device premium matrix", () => {
  beforeEach(() => {
    resetCapabilityCache();
    resetAdaptiveRuntime();
  });
  afterEach(() => {
    resetCapabilityCache();
    resetAdaptiveRuntime();
  });

  for (const surface of SURFACES) {
    it(`${surface.id}: Soul Engine ready, CSS-safe orb, no forbidden copy`, () => {
      withEnv(
        {
          userAgent: surface.ua,
          hardwareConcurrency: "hardwareConcurrency" in surface ? surface.hardwareConcurrency : 4,
          deviceMemory: "deviceMemory" in surface ? surface.deviceMemory : undefined,
          maxTouchPoints: /iphone|android|mobile/i.test(surface.ua) ? 5 : 0,
        },
        () => {
          const runtime = getAdaptiveRuntime();
          assert.equal(runtime.ready, surface.expectReady);
          assert.equal(runtime.strategy.soulEngine, surface.expectSoul);
          assert.equal(resolveOrbRenderMode(), surface.expectOrb);

          // Missing WebGPU alone must not force short personality on phones.
          const profile = detectCapabilityProfile();
          assert.equal(profile.webgpu, false);
          const strategy = resolveIntelligenceStrategy(profile);
          if (!surface.expectShortForcedByMissingGpu) {
            assert.equal(strategy.preferShortResponses, false);
          }

          const reply = buddyReplyToText({
            text: "hey, how are you feeling about today?",
            name: "Buddie",
            voice: "warm",
            depth: 2,
            seed: `matrix:${surface.id}`,
          }).text;
          assert.ok(reply.length > 8);
          assert.doesNotMatch(reply, FORBIDDEN_USER_COPY);
          assert.doesNotMatch(reply, /iPhone|Android|Safari|Chrome|Firefox|Edge|WebGPU/i);

          const enriched = applyAdaptiveEnrichment(reply, `e:${surface.id}`);
          assert.doesNotMatch(enriched, FORBIDDEN_USER_COPY);
        },
      );
    });
  }

  it("same voice yields coherent Soul replies across iPhone and desktop Chrome", () => {
    const seeds = { text: "I had a rough morning", voice: "warm" as const, name: "Buddie", depth: 3 };
    let phone = "";
    let desktop = "";
    withEnv(
      {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
        hardwareConcurrency: 6,
      },
      () => {
        phone = buddyReplyToText({ ...seeds, seed: "parity:phone" }).text;
      },
    );
    withEnv(
      {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        hardwareConcurrency: 16,
        deviceMemory: 16,
        gpu: { requestAdapter: async () => ({}) },
      },
      () => {
        desktop = buddyReplyToText({ ...seeds, seed: "parity:desktop" }).text;
      },
    );
    assert.ok(phone.length > 8);
    assert.ok(desktop.length > 8);
    assert.doesNotMatch(phone, FORBIDDEN_USER_COPY);
    assert.doesNotMatch(desktop, FORBIDDEN_USER_COPY);
    // Both paths must be Soul Engine / local — never expose which path.
    assert.equal(getAdaptiveRuntime().strategy.soulEngine, true);
  });

  it("runtime is ready before any optional warm-up", () => {
    withEnv(
      {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      },
      () => {
        const r = getAdaptiveRuntime();
        assert.equal(r.ready, true);
        assert.equal(r.optionalWarming, false);
      },
    );
  });
});
