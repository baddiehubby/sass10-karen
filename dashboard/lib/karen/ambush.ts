/**
 * Ambush mechanic — open-ended traps that force long personal answers,
 * then ruthlessly flip (Faith Shatter) on short / excuse-laden replies.
 */

import interrogation from "@/data/interrogation.json";
import { normalizeKarenAudioUrl } from "@/lib/karen/audio-cache";
import {
  VIP_TRUST_FREE_INTERACTIONS,
  readVipTrustState,
  writeVipTrustState,
} from "@/lib/karen/vip-trust";

export type AmbushTrap = {
  id: string;
  prompt: string;
  hint?: string;
};

export const AMBUSH_TRAPS: readonly AmbushTrap[] = (
  interrogation as { ambushTraps: AmbushTrap[] }
).ambushTraps;

export const AMBUSH_FAITH_SHATTER_LINE =
  "Are you kidding me? That is the most pathetic thing I have ever heard. You are a lost cause. VIP access revoked.";

/** Cache-hot brutal lecture for the flip. */
export const AMBUSH_FAITH_SHATTER_SRC = normalizeKarenAudioUrl(
  "smackbacks/brutal_01.wav",
);

/** Soft mock if they actually typed something substantial (still mean). */
export const AMBUSH_LONG_MOCK_LINE =
  "Interesting. You typed a lot and still said nothing that matters. Noted. I'll remember this.";

export const AMBUSH_LONG_MOCK_SRC = normalizeKarenAudioUrl(
  "smackbacks/dominance_02.wav",
);

/** Minimum substance before we treat the answer as "real effort". */
export const AMBUSH_MIN_WORDS = 12;
export const AMBUSH_MIN_CHARS = 48;

const EXCUSE_PATTERNS: readonly RegExp[] = [
  /\bi\s*don'?t\s*know\b/i,
  /\bidk\b/i,
  /\bnot\s*sure\b/i,
  /\bi'?m\s*trying\b/i,
  /\btrying\s*my\s*best\b/i,
  /\bwhatever\b/i,
  /\bnothing\b/i,
  /\bit'?s\s*fine\b/i,
  /\bno\s*excuse\b/i,
  /\bbusy\b/i,
  /\btired\b/i,
  /\blater\b/i,
  /\bmaybe\s*tomorrow\b/i,
  /\bi\s*guess\b/i,
  /\bdunno\b/i,
  /\bwho\s*cares\b/i,
  /\bdoesn'?t\s*matter\b/i,
];

export type AmbushAnalysis = {
  raw: string;
  wordCount: number;
  charCount: number;
  short: boolean;
  hasExcuse: boolean;
  /** Weak answer → Faith Shatter. */
  faithShatter: boolean;
  matchedExcuses: string[];
};

export function pickAmbushTrap(rng: () => number = Math.random): AmbushTrap {
  const list = AMBUSH_TRAPS;
  return list[Math.floor(rng() * list.length)] ?? list[0]!;
}

export function analyzeAmbushAnswer(transcript: string): AmbushAnalysis {
  const raw = transcript.replace(/\s+/g, " ").trim();
  const words = raw ? raw.split(" ").filter(Boolean) : [];
  const wordCount = words.length;
  const charCount = raw.length;
  const short = wordCount < AMBUSH_MIN_WORDS || charCount < AMBUSH_MIN_CHARS;
  const matchedExcuses: string[] = [];
  for (const re of EXCUSE_PATTERNS) {
    const m = raw.match(re);
    if (m?.[0]) matchedExcuses.push(m[0].toLowerCase());
  }
  const hasExcuse = matchedExcuses.length > 0;
  return {
    raw,
    wordCount,
    charCount,
    short,
    hasExcuse,
    faithShatter: short || hasExcuse,
    matchedExcuses,
  };
}

/** Instantly end VIP Trust — badge revoked, paywall returns. */
export function revokeVipTrustAccess(): void {
  const cur = readVipTrustState();
  writeVipTrustState({
    welcomeComplete: true,
    interactions: Math.max(cur.interactions, VIP_TRUST_FREE_INTERACTIONS),
  });
}

export function ambushShatterResult(analysis: AmbushAnalysis): {
  text: string;
  src: string;
  faithShatter: boolean;
} {
  if (analysis.faithShatter) {
    return {
      text: AMBUSH_FAITH_SHATTER_LINE,
      src: AMBUSH_FAITH_SHATTER_SRC,
      faithShatter: true,
    };
  }
  return {
    text: AMBUSH_LONG_MOCK_LINE,
    src: AMBUSH_LONG_MOCK_SRC,
    faithShatter: false,
  };
}
