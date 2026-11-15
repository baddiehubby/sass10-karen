/**
 * Karen expression bridge (Stage 6C-A).
 *
 * Maps personality mood / intensity / faceCue → ARKit-compatible blendshape weights.
 * Pure + deterministic: no Three.js, Aniface, webcam, MediaPipe, timers, or randomness.
 * Animation motion (blink / jaw / eye-roll pulse) is driven only by caller-supplied phase.
 */

import type { KarenFaceCue, KarenIntensity, KarenMood } from "@/lib/karen/interview/types";

/** ARKit / MediaPipe-compatible morph target names used by this bridge. */
export type KarenArkitBlendshapeName =
  | "eyeBlinkLeft"
  | "eyeBlinkRight"
  | "eyeSquintLeft"
  | "eyeSquintRight"
  | "eyeLookUpLeft"
  | "eyeLookUpRight"
  | "browDownLeft"
  | "browDownRight"
  | "browInnerUp"
  | "browOuterUpLeft"
  | "browOuterUpRight"
  | "noseSneerLeft"
  | "noseSneerRight"
  | "mouthSmileLeft"
  | "mouthSmileRight"
  | "mouthFrownLeft"
  | "mouthFrownRight"
  | "mouthDimpleLeft"
  | "mouthStretchLeft"
  | "mouthStretchRight"
  | "jawOpen"
  | "mouthClose";

export type KarenArkitBlendshapes = Record<KarenArkitBlendshapeName, number>;

export type KarenAvatarPresence = "speaking" | "listening";

export type KarenExpressionBridgeInput = {
  mood?: KarenMood | string | null;
  intensity?: number | null;
  faceCue?: KarenFaceCue | string | null;
  /** speaking → jaw driven by animationPhase; listening → idle blink. Default: listening. */
  presence?: KarenAvatarPresence | string | null;
  /**
   * Explicit animation phase (any finite number).
   * Interpreted modulo 1 for blink / eye-roll windows; used as radians-scale for jaw.
   * Missing/invalid → 0 (static frame, no motion).
   */
  animationPhase?: number | null;
  /** When true (crisis bypass), force softened expression regardless of mood. */
  crisis?: boolean | null;
};

const MOODS: readonly KarenMood[] = ["sweet", "sarcastic", "annoyed", "furious"];
const CUES: readonly KarenFaceCue[] = [
  "smile",
  "smirk",
  "raised_eyebrow",
  "eye_roll",
  "glare",
  "shouting",
  "softened",
  "neutral",
];

const ZERO: KarenArkitBlendshapes = {
  eyeBlinkLeft: 0,
  eyeBlinkRight: 0,
  eyeSquintLeft: 0,
  eyeSquintRight: 0,
  eyeLookUpLeft: 0,
  eyeLookUpRight: 0,
  browDownLeft: 0,
  browDownRight: 0,
  browInnerUp: 0,
  browOuterUpLeft: 0,
  browOuterUpRight: 0,
  noseSneerLeft: 0,
  noseSneerRight: 0,
  mouthSmileLeft: 0,
  mouthSmileRight: 0,
  mouthFrownLeft: 0,
  mouthFrownRight: 0,
  mouthDimpleLeft: 0,
  mouthStretchLeft: 0,
  mouthStretchRight: 0,
  jawOpen: 0,
  mouthClose: 0,
};

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/** Match personality-controller intensity bounds (1–5). */
export function clampBridgeIntensity(n: unknown): KarenIntensity {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 3;
  if (v <= 1) return 1;
  if (v >= 5) return 5;
  return v as KarenIntensity;
}

function isMood(v: unknown): v is KarenMood {
  return typeof v === "string" && (MOODS as readonly string[]).includes(v);
}

function isCue(v: unknown): v is KarenFaceCue {
  return typeof v === "string" && (CUES as readonly string[]).includes(v);
}

function isPresence(v: unknown): v is KarenAvatarPresence {
  return v === "speaking" || v === "listening";
}

function normalizePhase(phase: unknown): number {
  if (typeof phase !== "number" || !Number.isFinite(phase)) return 0;
  return phase;
}

/** Phase fraction in [0, 1). */
function phaseFrac(phase: number): number {
  const f = phase % 1;
  return f < 0 ? f + 1 : f;
}

/**
 * Deterministic blink pulse from phase (triangular window near cycle start).
 * No timers / randomness — caller advances animationPhase.
 */
export function blinkFromPhase(phase: number): number {
  const t = phaseFrac(phase);
  if (t < 0.03) return clamp01(t / 0.03);
  if (t < 0.06) return clamp01(1 - (t - 0.03) / 0.03);
  return 0;
}

/**
 * Deterministic jaw open from speaking phase.
 * Uses absolute sine so repeated cycles stay smooth and bounded.
 */
export function jawFromPhase(phase: number, gain: number): number {
  return clamp01(Math.abs(Math.sin(phase * Math.PI * 2)) * gain);
}

/**
 * Occasional eye-roll look-up window within the phase cycle (annoyed / eye_roll).
 */
export function eyeRollFromPhase(phase: number, gain: number): number {
  const t = phaseFrac(phase);
  if (t >= 0.42 && t < 0.52) {
    const local = (t - 0.42) / 0.1;
    const envelope = local < 0.5 ? local * 2 : (1 - local) * 2;
    return clamp01(envelope * gain);
  }
  return 0;
}

function intensityGain(intensity: KarenIntensity): number {
  return intensity / 5;
}

/**
 * Derive a safe face cue when the caller omits one (mirrors faceFor semantics,
 * without importing personality-controller internals).
 */
function defaultCueForMood(mood: KarenMood, intensity: KarenIntensity, softened: boolean): KarenFaceCue {
  if (softened) return "softened";
  if (mood === "sweet") return "smile";
  if (mood === "sarcastic") return intensity >= 4 ? "smirk" : "raised_eyebrow";
  if (mood === "annoyed") return intensity >= 4 ? "glare" : "eye_roll";
  return intensity >= 4 ? "shouting" : "glare";
}

function applySoftened(out: KarenArkitBlendshapes, g: number, blink: number): void {
  out.mouthSmileLeft = clamp01(0.28 * g + 0.12);
  out.mouthSmileRight = clamp01(0.28 * g + 0.12);
  out.browInnerUp = clamp01(0.08 * g);
  out.eyeBlinkLeft = blink;
  out.eyeBlinkRight = blink;
}

function applySmile(out: KarenArkitBlendshapes, g: number, blink: number): void {
  out.mouthSmileLeft = clamp01(0.35 + 0.35 * g);
  out.mouthSmileRight = clamp01(0.35 + 0.35 * g);
  out.browOuterUpLeft = clamp01(0.05 * g);
  out.browOuterUpRight = clamp01(0.05 * g);
  out.eyeBlinkLeft = blink;
  out.eyeBlinkRight = blink;
}

function applySmirk(out: KarenArkitBlendshapes, g: number, blink: number): void {
  out.mouthSmileLeft = clamp01(0.45 + 0.4 * g);
  out.mouthSmileRight = clamp01(0.12 + 0.15 * g);
  out.mouthDimpleLeft = clamp01(0.2 + 0.25 * g);
  out.browOuterUpLeft = clamp01(0.35 + 0.4 * g);
  out.browOuterUpRight = clamp01(0.05 * g);
  out.eyeBlinkLeft = blink;
  out.eyeBlinkRight = blink;
}

function applyRaisedEyebrow(out: KarenArkitBlendshapes, g: number, blink: number): void {
  out.mouthSmileLeft = clamp01(0.22 + 0.2 * g);
  out.mouthSmileRight = clamp01(0.08 + 0.1 * g);
  out.browOuterUpLeft = clamp01(0.45 + 0.45 * g);
  out.browOuterUpRight = clamp01(0.05 * g);
  out.eyeBlinkLeft = blink;
  out.eyeBlinkRight = blink;
}

function applyEyeRoll(out: KarenArkitBlendshapes, g: number, blink: number, phase: number): void {
  out.browDownLeft = clamp01(0.25 + 0.35 * g);
  out.browDownRight = clamp01(0.25 + 0.35 * g);
  out.eyeSquintLeft = clamp01(0.2 + 0.25 * g);
  out.eyeSquintRight = clamp01(0.2 + 0.25 * g);
  const roll = eyeRollFromPhase(phase, 0.55 + 0.35 * g);
  out.eyeLookUpLeft = roll;
  out.eyeLookUpRight = roll;
  out.mouthFrownLeft = clamp01(0.1 + 0.15 * g);
  out.mouthFrownRight = clamp01(0.1 + 0.15 * g);
  out.eyeBlinkLeft = blink;
  out.eyeBlinkRight = blink;
}

function applyGlare(out: KarenArkitBlendshapes, g: number, blink: number, furious: boolean): void {
  out.browDownLeft = clamp01(0.45 + 0.5 * g);
  out.browDownRight = clamp01(0.45 + 0.5 * g);
  out.eyeSquintLeft = clamp01(0.35 + 0.4 * g);
  out.eyeSquintRight = clamp01(0.35 + 0.4 * g);
  if (furious) {
    out.noseSneerLeft = clamp01(0.25 + 0.35 * g);
    out.noseSneerRight = clamp01(0.25 + 0.35 * g);
    out.mouthFrownLeft = clamp01(0.35 + 0.4 * g);
    out.mouthFrownRight = clamp01(0.35 + 0.4 * g);
  } else {
    out.mouthFrownLeft = clamp01(0.2 + 0.25 * g);
    out.mouthFrownRight = clamp01(0.2 + 0.25 * g);
  }
  out.eyeBlinkLeft = blink;
  out.eyeBlinkRight = blink;
}

function applyShouting(out: KarenArkitBlendshapes, g: number, blink: number): void {
  applyGlare(out, g, blink, true);
  out.jawOpen = clamp01(0.35 + 0.45 * g);
  out.mouthStretchLeft = clamp01(0.25 + 0.35 * g);
  out.mouthStretchRight = clamp01(0.25 + 0.35 * g);
  out.mouthFrownLeft = clamp01(0.2 * g);
  out.mouthFrownRight = clamp01(0.2 * g);
}

function applyNeutralListening(out: KarenArkitBlendshapes, blink: number): void {
  out.eyeBlinkLeft = blink;
  out.eyeBlinkRight = blink;
}

function clampAll(out: KarenArkitBlendshapes): KarenArkitBlendshapes {
  const next = { ...ZERO };
  for (const key of Object.keys(ZERO) as KarenArkitBlendshapeName[]) {
    next[key] = clamp01(out[key] ?? 0);
  }
  return next;
}

/**
 * Resolve Karen mood / intensity / faceCue into ARKit blendshape weights (0–1).
 * Independent of rendering; safe for unit tests without Three.js / Aniface.
 */
export function resolveKarenExpression(input: KarenExpressionBridgeInput = {}): KarenArkitBlendshapes {
  const crisis = Boolean(input.crisis);
  const intensity = clampBridgeIntensity(input.intensity);
  const g = intensityGain(intensity);
  const phase = normalizePhase(input.animationPhase);
  const presence: KarenAvatarPresence = isPresence(input.presence) ? input.presence : "listening";

  let mood: KarenMood = isMood(input.mood) ? input.mood : "sweet";
  let faceCue: KarenFaceCue = isCue(input.faceCue)
    ? input.faceCue
    : defaultCueForMood(mood, intensity, crisis);

  // Crisis / softened: never allow furious / aggressive shapes.
  const softened = crisis || faceCue === "softened";
  if (softened) {
    mood = "sweet";
    faceCue = "softened";
  }

  const blink = blinkFromPhase(phase);
  const out: KarenArkitBlendshapes = { ...ZERO };

  // Face cue drives the pose (matches personality-controller faceFor outputs).
  if (softened || faceCue === "softened") {
    applySoftened(out, g, blink);
  } else if (faceCue === "smile") {
    applySmile(out, g, blink);
  } else if (faceCue === "smirk") {
    applySmirk(out, g, blink);
  } else if (faceCue === "raised_eyebrow") {
    applyRaisedEyebrow(out, g, blink);
  } else if (faceCue === "eye_roll") {
    applyEyeRoll(out, g, blink, phase);
  } else if (faceCue === "glare") {
    applyGlare(out, g, blink, mood === "furious");
  } else if (faceCue === "shouting") {
    applyShouting(out, g, blink);
  } else if (faceCue === "neutral") {
    applyNeutralListening(out, blink);
  } else if (mood === "sweet") {
    applySmile(out, g, blink);
  } else if (mood === "sarcastic") {
    applyRaisedEyebrow(out, g, blink);
  } else if (mood === "annoyed") {
    applyEyeRoll(out, g, blink, phase);
  } else if (mood === "furious") {
    applyGlare(out, g, blink, true);
  } else {
    applyNeutralListening(out, blink);
  }

  if (presence === "speaking") {
    const speakGain =
      faceCue === "shouting" && !softened ? clamp01(0.55 + 0.4 * g) : clamp01(0.25 + 0.35 * g);
    const jaw = jawFromPhase(phase, speakGain);
    out.jawOpen = clamp01(Math.max(out.jawOpen, jaw));
    out.mouthClose = clamp01((1 - jaw) * 0.15 * g);
  }

  return clampAll(out);
}

/** Snapshot helper for tests / debug — sorted entries with non-zero weights. */
export function nonZeroBlendshapes(shapes: KarenArkitBlendshapes): Array<[string, number]> {
  return (Object.entries(shapes) as Array<[KarenArkitBlendshapeName, number]>)
    .filter(([, v]) => v > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));
}
