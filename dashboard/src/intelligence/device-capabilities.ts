/**
 * Device capability detection — internal only.
 * NEVER surface this profile (or OS/browser limitation copy) to the user.
 * Product experience stays one Buddie; only implementation path differs.
 */

import type { DeviceCapabilities } from "@/src/intelligence/types";

/** Normalized internal capability profile (not for UI). */
export type CapabilityProfile = {
  webgpu: boolean;
  webassembly: boolean;
  indexedDB: boolean;
  serviceWorker: boolean;
  persistentStorage: boolean;
  /** GiB estimate when safely available; otherwise null. */
  deviceMemoryGb: number | null;
  online: boolean;
  reducedMotion: boolean;
  /** Save-Data / low-end heuristic. */
  lowPower: boolean;
  /** Coarse browser class for strategy only — never shown. */
  browserClass: "chromium" | "webkit" | "gecko" | "unknown";
  /** Derived product flags — still internal. */
  localInference: boolean;
  semanticEngine: boolean;
  persistentCache: boolean;
  backgroundCapability: boolean;
  /** Tiny optional model only when genuinely practical (never large downloads). */
  optionalTinyModelPractical: boolean;
};

export type IntelligenceStrategyId = "full_local" | "composed_local";

export type IntelligenceStrategy = {
  id: IntelligenceStrategyId;
  /** Always true — Soul Engine is the product brain. */
  soulEngine: true;
  semanticLocal: true;
  conversationState: true;
  memory: true;
  proceduralComposition: true;
  /** Optional micro-enhancer; never required, never blocking. */
  optionalTinyModel: boolean;
  preferShortResponses: boolean;
  cachePersistence: boolean;
};

type NavigatorLike = {
  userAgent?: string;
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
  storage?: { persist?: () => Promise<boolean>; estimate?: () => Promise<unknown> };
  serviceWorker?: unknown;
  gpu?: { requestAdapter?: () => Promise<unknown> };
  hardwareConcurrency?: number;
};

type GlobalLike = {
  navigator?: NavigatorLike;
  indexedDB?: unknown;
  WebAssembly?: unknown;
  matchMedia?: (q: string) => { matches: boolean };
  document?: unknown;
};

let cachedProfile: CapabilityProfile | null = null;

export function resetCapabilityCache(): void {
  cachedProfile = null;
}

/** Detect capabilities once per session (sync, non-blocking). */
export function detectCapabilityProfile(env?: GlobalLike): CapabilityProfile {
  if (!env && cachedProfile) return cachedProfile;

  const g = env ?? (typeof globalThis !== "undefined" ? (globalThis as GlobalLike) : {});
  const nav = g.navigator ?? {};
  const ua = (nav.userAgent ?? "").toLowerCase();

  const webassembly = typeof g.WebAssembly !== "undefined";
  const indexedDB = typeof g.indexedDB !== "undefined";
  const serviceWorker = typeof nav.serviceWorker !== "undefined";
  const webgpu = Boolean(nav.gpu && typeof nav.gpu.requestAdapter === "function");

  let deviceMemoryGb: number | null = null;
  if (typeof nav.deviceMemory === "number" && Number.isFinite(nav.deviceMemory) && nav.deviceMemory > 0) {
    deviceMemoryGb = nav.deviceMemory;
  }

  const online =
    typeof (nav as { onLine?: boolean }).onLine === "boolean"
      ? Boolean((nav as { onLine?: boolean }).onLine)
      : true;

  let reducedMotion = false;
  try {
    if (typeof g.matchMedia === "function") {
      reducedMotion = Boolean(g.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }
  } catch {
    reducedMotion = false;
  }

  const saveData = Boolean(nav.connection?.saveData);
  const slowNet = /2g/.test(nav.connection?.effectiveType ?? "");
  const lowMem = deviceMemoryGb !== null && deviceMemoryGb <= 4;
  // Do NOT treat missing WebGPU + few cores as "low power" — that shortened iPhone
  // personality vs desktop. Save-Data / slow net / tiny memory are real constraints.
  const lowPower = saveData || slowNet || lowMem;

  const browserClass = classifyBrowser(ua);
  const persistentStorage = indexedDB || serviceWorker;

  // Soul + semantic always on every supported surface — $0, instant.
  const semanticEngine = true;
  const localInference = true;
  const persistentCache = persistentStorage;
  const backgroundCapability = Boolean(serviceWorker && online !== false);

  // Tiny optional path only when memory/WASM/WebGPU suggest it won't hurt UX.
  // Never implies a large model download.
  const optionalTinyModelPractical =
    webassembly &&
    !lowPower &&
    !reducedMotion &&
    (webgpu || (deviceMemoryGb !== null && deviceMemoryGb >= 8) || (deviceMemoryGb === null && browserClass === "chromium" && !/iphone|ipad|ipod|mobile/.test(ua)));

  const profile: CapabilityProfile = {
    webgpu,
    webassembly,
    indexedDB,
    serviceWorker,
    persistentStorage,
    deviceMemoryGb,
    online,
    reducedMotion,
    lowPower,
    browserClass,
    localInference,
    semanticEngine,
    persistentCache,
    backgroundCapability,
    optionalTinyModelPractical,
  };

  if (!env) cachedProfile = profile;
  return profile;
}

export function resolveIntelligenceStrategy(profile?: CapabilityProfile): IntelligenceStrategy {
  const p = profile ?? detectCapabilityProfile();

  // Limited / WebKit-class: composed local path — same Soul Engine character, no optional enricher.
  // Prefer short replies only for genuine a11y / network constraints — never for "Safari".
  if (!p.optionalTinyModelPractical || p.lowPower || p.browserClass === "webkit") {
    return {
      id: "composed_local",
      soulEngine: true,
      semanticLocal: true,
      conversationState: true,
      memory: true,
      proceduralComposition: true,
      optionalTinyModel: false,
      preferShortResponses: p.reducedMotion || p.lowPower,
      cachePersistence: p.persistentCache,
    };
  }

  return {
    id: "full_local",
    soulEngine: true,
    semanticLocal: true,
    conversationState: true,
    memory: true,
    proceduralComposition: true,
    optionalTinyModel: true,
    preferShortResponses: p.reducedMotion,
    cachePersistence: p.persistentCache,
  };
}

/** Map profile → legacy DeviceCapabilities used by the composer. */
export function toComposerDeviceCaps(
  profile?: CapabilityProfile,
  partial?: Partial<DeviceCapabilities>,
): DeviceCapabilities {
  const p = profile ?? detectCapabilityProfile();
  return {
    reducedMotion: partial?.reducedMotion ?? p.reducedMotion,
    lowPower: partial?.lowPower ?? p.lowPower,
    online: partial?.online ?? p.online,
  };
}

export function defaultDeviceCapabilities(partial?: Partial<DeviceCapabilities>): DeviceCapabilities {
  return toComposerDeviceCaps(undefined, partial);
}

export function preferredResponseLength(device?: DeviceCapabilities): "short" | "medium" {
  if (device?.lowPower || device?.reducedMotion) return "short";
  return "medium";
}

/**
 * Example shape for internal docs/tests — not for UI.
 * { localInference, semanticEngine, persistentCache, backgroundCapability }
 */
export function publicInternalFlags(profile?: CapabilityProfile): {
  localInference: boolean;
  semanticEngine: boolean;
  persistentCache: boolean;
  backgroundCapability: boolean;
} {
  const p = profile ?? detectCapabilityProfile();
  return {
    localInference: p.localInference,
    semanticEngine: p.semanticEngine,
    persistentCache: p.persistentCache,
    backgroundCapability: p.backgroundCapability,
  };
}

function classifyBrowser(ua: string): CapabilityProfile["browserClass"] {
  if (/firefox|gecko\//.test(ua) && !/like gecko/.test(ua)) return "gecko";
  // iOS Chrome/Firefox still WebKit under the hood
  if (/iphone|ipad|ipod/.test(ua)) return "webkit";
  if (/safari/.test(ua) && !/chrome|chromium|crios|edg|opr|fxios/.test(ua)) return "webkit";
  if (/chrome|chromium|edg|opr|crios/.test(ua)) return "chromium";
  return "unknown";
}
