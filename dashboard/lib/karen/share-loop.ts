/**
 * Viral share / challenge / daily retention helpers (localStorage only).
 */

import type { TraitScores } from "@/lib/karen/game-engine";
import { buildPersonalityProfile } from "@/lib/karen/result-profile";

export const KAREN_SHARE_ORIGIN = "https://karensass10.com";
export const KAREN_LAST_PLAY_KEY = "karen.roast.lastPlayDay";
/** Spec alias — free tier once/day check (`localStorage.getItem('lastPlayed')`). */
export const KAREN_LAST_PLAYED_KEY = "lastPlayed";
export const KAREN_LAST_RESULT_KEY = "karen.roast.lastResult";
export const KAREN_PLAYED_BEFORE_KEY = "karen.roast.playedBefore";

export type ChallengeInvite = {
  score: number;
  trait: string;
};

export type StoredRoastResult = {
  scores: TraitScores;
  title: string;
  verdict: string;
  challengeScore: number;
  trait: string;
  savedAt: string;
};

export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function traitDisplayName(trait: string): string {
  const t = trait.toLowerCase().trim();
  if (t === "overthinking") return "Overthinking";
  if (t === "laziness") return "Laziness";
  if (t === "chaos") return "Chaos";
  if (!t) return "Overthinking";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Normalize challenge trait query → roast trait id. */
export function normalizeChallengeTrait(raw: string | null | undefined): string {
  const t = (raw || "overthinking").toLowerCase().trim();
  if (t === "lazy" || t === "laziness") return "laziness";
  if (t === "chaos" || t === "chaotic") return "chaos";
  if (t === "overthink" || t === "overthinking") return "overthinking";
  return "overthinking";
}

export function buildChallengeUrl(challengeScore: number, trait = "overthinking"): string {
  const score = Math.max(0, Math.min(100, Math.round(challengeScore)));
  const t = normalizeChallengeTrait(trait);
  return `${KAREN_SHARE_ORIGIN}/karen?challenge=${score}&trait=${encodeURIComponent(t)}`;
}

export function parseChallengeScore(search: string | URLSearchParams): number | null {
  const invite = parseChallengeInvite(search);
  return invite?.score ?? null;
}

export function parseChallengeInvite(
  search: string | URLSearchParams,
): ChallengeInvite | null {
  const params =
    typeof search === "string" ? new URLSearchParams(search.replace(/^\?/, "")) : search;
  const raw = params.get("challenge");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return {
    score: Math.max(0, Math.min(100, Math.round(n))),
    trait: normalizeChallengeTrait(params.get("trait")),
  };
}

export function challengeTaunt(score: number, trait = "overthinking"): string {
  return `Your friend scored a ${score} in ${traitDisplayName(trait)}. Can you beat that? Probably not.`;
}

/** Same-day lock copy when free users try to play the roast again today. */
export function retentionPrompt(): string {
  return "I already know everything about you. Come back tomorrow.";
}

/** True when they already finished a roast today (UTC day). */
export function hasPlayedToday(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const day = utcDayKey();
    const lastPlayed = window.localStorage.getItem(KAREN_LAST_PLAYED_KEY);
    const legacy = window.localStorage.getItem(KAREN_LAST_PLAY_KEY);
    return lastPlayed === day || legacy === day;
  } catch {
    return false;
  }
}

/**
 * Gate retention: played earlier today, no challenge invite.
 * (Challenge links still open so the viral loop works.)
 */
export function shouldShowDailyRetention(): boolean {
  return hasPlayedToday();
}

export function markDailyPlay(scores: TraitScores): StoredRoastResult {
  const profile = buildPersonalityProfile(scores);
  const payload: StoredRoastResult = {
    scores,
    title: profile.title,
    verdict: profile.verdict,
    challengeScore: profile.challengeScore,
    trait: profile.trait,
    savedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      const day = utcDayKey();
      window.localStorage.setItem(KAREN_LAST_PLAY_KEY, day);
      window.localStorage.setItem(KAREN_LAST_PLAYED_KEY, day);
      window.localStorage.setItem(KAREN_PLAYED_BEFORE_KEY, "1");
      window.localStorage.setItem(KAREN_LAST_RESULT_KEY, JSON.stringify(payload));
      window.sessionStorage.setItem(KAREN_LAST_RESULT_KEY, JSON.stringify(payload));
    } catch {
      /* private mode */
    }
  }
  return payload;
}

export function readStoredResult(): StoredRoastResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.sessionStorage.getItem(KAREN_LAST_RESULT_KEY) ||
      window.localStorage.getItem(KAREN_LAST_RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredRoastResult;
  } catch {
    return null;
  }
}

/** Snapshot the live TalkingHead canvas for the share card. */
export function captureKarenAvatarDataUrl(): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.querySelector(
    '[aria-label="Karen 3D avatar"] canvas',
  ) as HTMLCanvasElement | null;
  if (!canvas) return null;
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
