/**
 * Orb render policy — WebGL is an enhancement, never a dependency.
 * iPhone Safari / low-power / reduced-motion prefer CSS BuddyOrb.
 */

import { detectCapabilityProfile } from "@/src/intelligence/device-capabilities";

export type OrbRenderMode = "css" | "webgl";

function hasWebGl(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

/**
 * Decide orb path once per call (cheap). WebGPU is never consulted —
 * Three.js uses WebGL; WebGPU remains optional for intelligence only.
 */
export function resolveOrbRenderMode(opts?: {
  forceCss?: boolean;
  forceWebGl?: boolean;
}): OrbRenderMode {
  if (opts?.forceCss) return "css";
  if (opts?.forceWebGl && hasWebGl()) return "webgl";

  if (typeof window === "undefined") return "css";

  const profile = detectCapabilityProfile();
  if (profile.reducedMotion || profile.lowPower) return "css";
  // iOS / WebKit: CSS orb is the first-class product path (smooth, low memory).
  if (profile.browserClass === "webkit") return "css";

  // Any phone / tablet UA — prefer CSS for battery + scroll smoothness.
  try {
    const ua = navigator.userAgent || "";
    if (/iphone|ipad|ipod|android|mobile/i.test(ua)) return "css";
    if (window.matchMedia("(max-width: 900px), (pointer: coarse)").matches) return "css";
  } catch {
    /* ignore */
  }

  if (!hasWebGl()) return "css";

  return "webgl";
}
