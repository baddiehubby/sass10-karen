/**
 * VIP Trust onboarding — soft gold welcome, then 3 fake-premium interactions
 * before the rage-bait trap snaps shut.
 */

export const VIP_TRUST_STORAGE_KEY = "karen.vipTrust.v1";
/** Persists after Faith Shatter so refresh cannot escape the $20 ultimatum. */
export const FAITH_SHATTER_LOCK_KEY = "karen.faithShatter.lock";
export const VIP_TRUST_FREE_INTERACTIONS = 3;

export const VIP_TRUST_WELCOME_LINE =
  "Welcome. I don't let just anyone in here. I see potential in you. Let's see if you have what it takes.";

export const VIP_TRUST_GOAL_LINE =
  "That's a good goal. I'll be watching. Don't let me down.";

/** Soft WAV for lipsync while TTS/welcome line plays (cache-hot smackback). */
export const VIP_TRUST_WELCOME_SRC = "/audio/smackbacks/sb_15.wav";
export const VIP_TRUST_GOAL_SRC = "/audio/smackbacks/sb_48.wav";

export type VipTrustState = {
  /** Soft welcome gate completed. */
  welcomeComplete: boolean;
  /** Count of post-welcome interactions (goals / screams). */
  interactions: number;
};

const DEFAULT_STATE: VipTrustState = {
  welcomeComplete: false,
  interactions: 0,
};

function safeParse(raw: string | null): VipTrustState {
  if (!raw) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<VipTrustState>;
    return {
      welcomeComplete: Boolean(parsed.welcomeComplete),
      interactions: Math.max(0, Number(parsed.interactions) || 0),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function readVipTrustState(): VipTrustState {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  try {
    return safeParse(window.localStorage.getItem(VIP_TRUST_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeVipTrustState(next: VipTrustState): VipTrustState {
  if (typeof window === "undefined") return next;
  try {
    window.localStorage.setItem(VIP_TRUST_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function markVipTrustWelcomeComplete(): VipTrustState {
  const cur = readVipTrustState();
  return writeVipTrustState({ ...cur, welcomeComplete: true });
}

/** True while the soft onboarding window is still open (after welcome, < 3 hits). */
export function isVipTrustActive(state = readVipTrustState()): boolean {
  return state.welcomeComplete && state.interactions < VIP_TRUST_FREE_INTERACTIONS;
}

/** Show the glowing badge after welcome until the trap closes. */
export function shouldShowVipTrustBadge(state = readVipTrustState()): boolean {
  return state.welcomeComplete && state.interactions < VIP_TRUST_FREE_INTERACTIONS;
}

/**
 * Fake premium during the trust window — unlocks planner / features with no paywall.
 * Real VIP always wins.
 */
export function hasVipTrustPremium(
  realPremium: boolean,
  state = readVipTrustState(),
): boolean {
  return realPremium || isVipTrustActive(state);
}

/** Increment interaction counter; returns the new count. */
export function bumpVipTrustInteraction(): number {
  const cur = readVipTrustState();
  if (!cur.welcomeComplete) return cur.interactions;
  const interactions = cur.interactions + 1;
  writeVipTrustState({ ...cur, interactions });
  return interactions;
}

/** Remaining soft interactions before the trap. */
export function vipTrustRemaining(state = readVipTrustState()): number {
  if (!state.welcomeComplete) return VIP_TRUST_FREE_INTERACTIONS;
  return Math.max(0, VIP_TRUST_FREE_INTERACTIONS - state.interactions);
}

/** Faith Shatter paywall lock — survives reload until Lemon VIP is granted. */
export function readFaithShatterLock(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FAITH_SHATTER_LOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeFaithShatterLock(locked: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (locked) window.localStorage.setItem(FAITH_SHATTER_LOCK_KEY, "1");
    else window.localStorage.removeItem(FAITH_SHATTER_LOCK_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * Goal-like transcript during trust — supportive, not typo-roast.
 * "go to the gym", "I want to quit smoking", short commitment phrases.
 */
export function isVipTrustGoalTranscript(transcript: string): boolean {
  const t = transcript.replace(/\s+/g, " ").trim().toLowerCase();
  if (!t || t.length < 3) return false;
  if (
    /^(um+|uh+|hmm+|ah+|er+|like|whatever|idk|lol|lmao|ok|okay|k)\b/.test(t)
  ) {
    return false;
  }
  return (
    /\b(goal|gym|workout|diet|quit|study|work|sleep|wake|run|walk|meditat|save|money|job|interview|code|write|read|practice)\b/i.test(
      t,
    ) ||
    /^(i\s+(want|will|need|gotta|have\s+to)|i'?m\s+gonna|going\s+to|start|finish|stop)\b/i.test(
      t,
    ) ||
    t.split(" ").length >= 3
  );
}
