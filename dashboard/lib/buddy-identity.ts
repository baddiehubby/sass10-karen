export type AuraId =
  | "ember"
  | "soft-aura"
  | "night-halo"
  | "aurora"
  | "constellation"
  | "deep-field"
  | "seasonal-veil"
  | "oracle-sigil";

export type AnimationPersonality = "soft" | "playful" | "still-glow";

export type BuddyIdentity = {
  version: 1;
  startedAt: string;
  auraId: AuraId;
  animation: AnimationPersonality;
  unlocked: AuraId[];
  oracleVisits: number;
  lastOracleAt?: string;
  lastMorningRitual?: string;
  lastEveningRitual?: string;
  intention?: { date: string; text: string };
  lastMomentId?: string;
  lastMomentAt?: string;
  seenMomentIds: string[];
  lastUnlockId?: AuraId;
  lastUnlockAt?: string;
};

const IDENTITY_KEY = "buddy_identity_v1";

export function localDayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function defaultIdentity(now = new Date()): BuddyIdentity {
  return {
    version: 1,
    startedAt: now.toISOString(),
    auraId: "ember",
    animation: "soft",
    unlocked: ["ember"],
    oracleVisits: 0,
    seenMomentIds: [],
  };
}

function readIdentity(): BuddyIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BuddyIdentity>;
    if (parsed.version !== 1) return null;
    return { ...defaultIdentity(), ...parsed, unlocked: parsed.unlocked?.length ? parsed.unlocked : ["ember"] };
  } catch {
    return null;
  }
}

export function loadIdentity(): BuddyIdentity {
  return readIdentity() ?? defaultIdentity();
}

export function saveIdentity(next: BuddyIdentity): BuddyIdentity {
  if (typeof window === "undefined") return next;
  try {
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  window.dispatchEvent(new Event("buddy-universe-changed"));
  return next;
}

export function patchIdentity(patch: Partial<BuddyIdentity>): BuddyIdentity {
  return saveIdentity({ ...loadIdentity(), ...patch });
}

export function resetIdentity(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(IDENTITY_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("buddy-universe-changed"));
}
