/**
 * Adaptive intelligence runtime — one Buddie, device-varying internals.
 * Core path is always ready; optional pieces warm in the background.
 */

import {
  detectCapabilityProfile,
  resolveIntelligenceStrategy,
  toComposerDeviceCaps,
  type CapabilityProfile,
  type IntelligenceStrategy,
} from "@/src/intelligence/device-capabilities";
import { getTinyLocalEnhancerSync, warmOptionalTinyModel } from "@/src/intelligence/adaptive/optional-tiny-model";
import type { DeviceCapabilities } from "@/src/intelligence/types";

export type AdaptiveRuntimeState = {
  ready: true;
  strategy: IntelligenceStrategy;
  /** Internal only — do not render. */
  profile: CapabilityProfile;
  optionalWarming: boolean;
};

let runtime: AdaptiveRuntimeState | null = null;
let warmStarted = false;

/**
 * Instant shell readiness — Soul Engine path is always available.
 * Does not wait for optional components.
 */
export function getAdaptiveRuntime(): AdaptiveRuntimeState {
  if (runtime) return runtime;
  const profile = detectCapabilityProfile();
  const strategy = resolveIntelligenceStrategy(profile);
  runtime = {
    ready: true,
    strategy,
    profile,
    optionalWarming: false,
  };
  return runtime;
}

/**
 * Kick optional warm-up without blocking first paint / first reply.
 * Safe to call from useEffect / idle callback.
 */
export function startAdaptiveIntelligenceWarmup(): void {
  if (warmStarted) return;
  warmStarted = true;
  const state = getAdaptiveRuntime();
  if (!state.strategy.optionalTinyModel) return;

  runtime = { ...state, optionalWarming: true };
  void warmOptionalTinyModel(true).finally(() => {
    if (runtime) runtime = { ...runtime, optionalWarming: false };
  });
}

export function composerCapsFromRuntime(partial?: Partial<DeviceCapabilities>): DeviceCapabilities {
  const { profile, strategy } = getAdaptiveRuntime();
  const caps = toComposerDeviceCaps(profile, partial);
  if (strategy.preferShortResponses) {
    return { ...caps, lowPower: true };
  }
  return caps;
}

/** Apply optional enricher if already warm; otherwise identity (never wait). */
export function applyAdaptiveEnrichment(text: string, seed: string): string {
  const { strategy } = getAdaptiveRuntime();
  if (!strategy.optionalTinyModel) return text;
  return getTinyLocalEnhancerSync().enrich(text, seed);
}

export function resetAdaptiveRuntime(): void {
  runtime = null;
  warmStarted = false;
}

/** Schedule warmup on idle when in a browser — never blocks. */
export function scheduleIdleWarmup(): void {
  if (typeof window === "undefined") return;
  const run = () => startAdaptiveIntelligenceWarmup();
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(run, { timeout: 2500 });
  } else {
    setTimeout(run, 1);
  }
}
