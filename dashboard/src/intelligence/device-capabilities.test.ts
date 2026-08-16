import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  detectCapabilityProfile,
  publicInternalFlags,
  resetCapabilityCache,
  resolveIntelligenceStrategy,
} from "@/src/intelligence/device-capabilities";
import {
  getAdaptiveRuntime,
  resetAdaptiveRuntime,
  applyAdaptiveEnrichment,
} from "@/src/intelligence/adaptive/runtime";
import { runSoulEngine } from "@/src/intelligence/soul-engine/run";
import { baseInput } from "@/src/intelligence/__fixtures__/intents";

describe("device capability profile", () => {
  beforeEach(() => {
    resetCapabilityCache();
    resetAdaptiveRuntime();
  });

  it("returns normalized flags without requiring a browser", () => {
    const profile = detectCapabilityProfile({
      WebAssembly: {},
      indexedDB: {},
      navigator: {
        userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0",
        deviceMemory: 8,
        hardwareConcurrency: 8,
        serviceWorker: {},
        gpu: { requestAdapter: async () => ({}) },
      },
      matchMedia: () => ({ matches: false }),
    });

    const flags = publicInternalFlags(profile);
    assert.equal(flags.localInference, true);
    assert.equal(flags.semanticEngine, true);
    assert.equal(flags.persistentCache, true);
    assert.equal(typeof flags.backgroundCapability, "boolean");
    assert.equal(profile.webassembly, true);
    assert.equal(profile.webgpu, true);
  });

  it("selects composed_local for WebKit / iPhone-class without exposing labels", () => {
    const profile = detectCapabilityProfile({
      WebAssembly: {},
      indexedDB: {},
      navigator: {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        hardwareConcurrency: 6,
      },
      matchMedia: () => ({ matches: false }),
    });

    assert.equal(profile.browserClass, "webkit");
    const strategy = resolveIntelligenceStrategy(profile);
    assert.equal(strategy.id, "composed_local");
    assert.equal(strategy.soulEngine, true);
    assert.equal(strategy.semanticLocal, true);
    assert.equal(strategy.proceduralComposition, true);
    assert.equal(strategy.optionalTinyModel, false);
    // Must never encode user-facing limitation copy in strategy
    assert.equal("message" in strategy, false);
  });

  it("selects full_local when optional tiny path is practical", () => {
    const profile = detectCapabilityProfile({
      WebAssembly: {},
      indexedDB: {},
      navigator: {
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        deviceMemory: 16,
        hardwareConcurrency: 12,
        serviceWorker: {},
        gpu: { requestAdapter: async () => ({}) },
      },
      matchMedia: () => ({ matches: false }),
    });

    const strategy = resolveIntelligenceStrategy(profile);
    assert.equal(strategy.id, "full_local");
    assert.equal(strategy.optionalTinyModel, true);
  });

  it("keeps low-power devices on composed_local", () => {
    const profile = detectCapabilityProfile({
      WebAssembly: {},
      indexedDB: {},
      navigator: {
        userAgent: "Mozilla/5.0 Chrome/120.0.0.0",
        deviceMemory: 2,
        hardwareConcurrency: 2,
        connection: { saveData: true, effectiveType: "2g" },
      },
      matchMedia: () => ({ matches: true }),
    });

    assert.equal(profile.lowPower, true);
    assert.equal(resolveIntelligenceStrategy(profile).id, "composed_local");
  });
});

describe("adaptive runtime", () => {
  beforeEach(() => {
    resetCapabilityCache();
    resetAdaptiveRuntime();
  });

  it("is ready immediately without waiting for optional modules", () => {
    const state = getAdaptiveRuntime();
    assert.equal(state.ready, true);
    assert.ok(state.strategy.soulEngine);
  });

  it("soul engine replies identically in product surface (no device messaging)", () => {
    const out = runSoulEngine(baseInput({ userText: "hey buddy", seed: "adapt-1" }));
    assert.equal(out.inference, "none");
    assert.match(out.text, /\S/);
    assert.doesNotMatch(out.text, /iPhone|Android|Safari|WebGPU|Chrome|unsupported|unavailable|cloud/i);
  });

  it("enrichment is identity when optional path is off", () => {
    detectCapabilityProfile({
      navigator: {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      },
    });
    resetAdaptiveRuntime();
    getAdaptiveRuntime();
    const text = "You're not talking into empty space.";
    assert.equal(applyAdaptiveEnrichment(text, "s"), text);
  });
});
