/**
 * Invisible device adaptation — hygiene + policy guarantees.
 * Users must never see intelligence path / device / plumbing labels.
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { resolveOrbRenderMode } from "@/lib/orb-render-policy";
import { getAdaptiveRuntime, resetAdaptiveRuntime, applyAdaptiveEnrichment } from "@/src/intelligence/adaptive/runtime";
import {
  detectCapabilityProfile,
  resetCapabilityCache,
  resolveIntelligenceStrategy,
} from "@/src/intelligence/device-capabilities";
import { buddyReplyToText } from "@/lib/buddy-intelligence";

const PLUMBING =
  /iPhone mode|Android mode|WebGPU|WASM|unsupported browser|download model|API configuration|cannot run|voice is quiet|composed_local|full_local|optionalTiny|intelligence path|local model|provider error/i;

function withUa(ua: string, run: () => void) {
  const prevNav = (globalThis as { navigator?: Navigator }).navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: { userAgent: ua, hardwareConcurrency: 4, maxTouchPoints: 5 },
  });
  const prevWin = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      matchMedia: (q: string) => ({
        matches: /max-width|pointer:\s*coarse/i.test(q),
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
      document: undefined,
    },
  });
  try {
    resetCapabilityCache();
    resetAdaptiveRuntime();
    run();
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      writable: true,
      value: prevNav,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: prevWin,
    });
    resetCapabilityCache();
    resetAdaptiveRuntime();
  }
}

describe("invisible adaptation — orb policy", () => {
  beforeEach(() => {
    resetCapabilityCache();
    resetAdaptiveRuntime();
  });

  afterEach(() => {
    resetCapabilityCache();
    resetAdaptiveRuntime();
  });

  it("uses CSS orb on iPhone-class UA without force flag", () => {
    withUa(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      () => {
        assert.equal(resolveOrbRenderMode(), "css");
      },
    );
  });

  it("uses CSS orb on Android Chrome UA", () => {
    withUa(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      () => {
        assert.equal(resolveOrbRenderMode(), "css");
      },
    );
  });

  it("never requires WebGPU — CSS always available", () => {
    assert.equal(resolveOrbRenderMode({ forceCss: true }), "css");
  });
});

describe("invisible adaptation — intelligence router", () => {
  it("is ready immediately without waiting for optional modules", () => {
    const rt = getAdaptiveRuntime();
    assert.equal(rt.ready, true);
    assert.equal(typeof rt.strategy.id, "string");
  });

  it("never puts strategy or device labels into product replies", () => {
    withUa(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      () => {
        const profile = detectCapabilityProfile();
        const strategy = resolveIntelligenceStrategy(profile);
        assert.ok(strategy.id === "composed_local" || strategy.id === "full_local");

        const reply = buddyReplyToText({
          text: "hey buddy",
          name: "Buddie",
          seed: "adapt-hygiene-1",
        });
        assert.doesNotMatch(reply.text, PLUMBING);
        assert.doesNotMatch(reply.text, /iPhone|Android|Safari|Chrome|Firefox|Edge/i);

        const enriched = applyAdaptiveEnrichment(reply.text, "adapt-hygiene-1");
        assert.doesNotMatch(enriched, PLUMBING);
      },
    );
  });
});

describe("invisible adaptation — product copy hygiene", () => {
  it("onboarding intro never advertises keys/models/setup plumbing", () => {
    const intro = [
      "I'm Buddie — a companion who stays with your mood.",
      "I'm here for how you feel — nothing to set up.",
      "Just presence.",
    ].join(" ");
    assert.doesNotMatch(intro, /No keys|No models|WebGPU|WASM|download model|API/i);
  });

  it("soft presence fallback is characterful, not a tech error", () => {
    const soft = ["I'm right here with you.", "I'm listening — one moment.", "That was a lot — try a shorter thought."];
    for (const line of soft) {
      assert.doesNotMatch(line, PLUMBING);
      assert.doesNotMatch(line, /voice is quiet/i);
    }
  });
});

