import type { CompanionPersonality, MoodCheckIn } from "@/lib/companion-mood";
import { isBuddyMood } from "@/lib/companion-mood";

const CHECKIN_KEY = "buddy_mood_checkins_v1";
const PERSONALITY_KEY = "buddy_personality_v1";
const ORACLE_STYLE_KEY = "buddy_oracle_style_v1";

export type OracleStyle = "cosmic" | "pandit";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadCheckIns(): MoodCheckIn[] {
  const rows = readJson<MoodCheckIn[]>(CHECKIN_KEY, []);
  return rows
    .filter((row) => row && isBuddyMood(row.mood) && typeof row.createdAt === "string")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function notifyMoodChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("buddy-mood-changed"));
}

export function saveCheckIn(entry: MoodCheckIn, limit = 90): MoodCheckIn[] {
  const next = [entry, ...loadCheckIns()].slice(0, limit);
  try {
    window.localStorage.setItem(CHECKIN_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  notifyMoodChanged();
  return next;
}

export function updateLatestCheckIn(patch: Partial<Pick<MoodCheckIn, "note" | "intensity" | "mood">>): MoodCheckIn[] {
  const rows = loadCheckIns();
  if (!rows[0]) return rows;
  const next = [{ ...rows[0], ...patch }, ...rows.slice(1)];
  try {
    window.localStorage.setItem(CHECKIN_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  notifyMoodChanged();
  return next;
}

export function clearCheckIns(): void {
  try {
    window.localStorage.removeItem(CHECKIN_KEY);
  } catch {
    /* ignore */
  }
  notifyMoodChanged();
}

const MEET_KEY = "buddy_meet_done_v1";

export function hasCompletedMeet(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(MEET_KEY) === "yes";
  } catch {
    return true;
  }
}

export function markMeetComplete(): void {
  try {
    window.localStorage.setItem(MEET_KEY, "yes");
  } catch {
    /* ignore */
  }
}

export function loadPersonality(): CompanionPersonality {
  const value = readJson<string>(PERSONALITY_KEY, "warm");
  if (value === "chill" || value === "playful" || value === "warm" || value === "mystical" || value === "focused") {
    return value;
  }
  return "warm";
}

export function savePersonality(value: CompanionPersonality): void {
  try {
    window.localStorage.setItem(PERSONALITY_KEY, value);
  } catch {
    /* ignore */
  }
  notifyMoodChanged();
}

export function loadOracleStyle(): OracleStyle {
  return readJson<OracleStyle>(ORACLE_STYLE_KEY, "cosmic") === "pandit" ? "pandit" : "cosmic";
}

export function saveOracleStyle(value: OracleStyle): void {
  try {
    window.localStorage.setItem(ORACLE_STYLE_KEY, value);
  } catch {
    /* ignore */
  }
}

const PREFS_KEY = "buddy_display_prefs_v1";

export type BuddyDisplayPrefs = {
  /** Override OS reduced-motion: force | never | auto */
  motion: "auto" | "reduce" | "full";
  lowPower: boolean;
  theme: "cosmic" | "ember" | "mist" | "night";
};

export function defaultDisplayPrefs(): BuddyDisplayPrefs {
  return { motion: "auto", lowPower: false, theme: "cosmic" };
}

export function loadDisplayPrefs(): BuddyDisplayPrefs {
  const raw = readJson<Partial<BuddyDisplayPrefs>>(PREFS_KEY, {});
  return {
    motion: raw.motion === "reduce" || raw.motion === "full" ? raw.motion : "auto",
    lowPower: Boolean(raw.lowPower),
    theme: raw.theme === "ember" || raw.theme === "mist" || raw.theme === "night" ? raw.theme : "cosmic",
  };
}

export function saveDisplayPrefs(patch: Partial<BuddyDisplayPrefs>): BuddyDisplayPrefs {
  const next = { ...loadDisplayPrefs(), ...patch };
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("buddy-prefs-changed"));
  }
  return next;
}

/** Effective reduced-motion for Orb (respects prefs + OS). */
export function effectiveReducedMotion(prefs = loadDisplayPrefs()): boolean {
  if (prefs.motion === "reduce" || prefs.lowPower) return true;
  if (prefs.motion === "full") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
