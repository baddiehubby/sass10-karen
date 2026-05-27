import type { BuddyMood } from "@/lib/mood-detection";

export type MoodHistoryEntry = {
  mood: BuddyMood;
  at: string;
};

export type GuidanceItem = {
  text: string;
  at: string;
  priority?: number;
};

/** Unified emotional state shared across PWA, extension, desktop overlay, and mobile. */
export type PresenceState = {
  licenseKey: string;
  currentMood: BuddyMood;
  moodHistory: MoodHistoryEntry[];
  lastCheckIn: string;
  guidanceQueue: GuidanceItem[];
  companionName: string;
};

export const PRESENCE_MOOD_SYNC_TAG = "buddy-mood-sync";
export const PRESENCE_CHECK_IN_TAG = "buddy-check-in";
export const PRESENCE_SYNC_INTERVAL_MS = 15 * 60 * 1000;

const MAX_HISTORY = 48;
const MAX_GUIDANCE = 12;

export function createDefaultPresenceState(licenseKey: string, companionName = "Buddy"): PresenceState {
  const now = new Date().toISOString();
  return {
    licenseKey,
    currentMood: "neutral",
    moodHistory: [{ mood: "neutral", at: now }],
    lastCheckIn: now,
    guidanceQueue: [],
    companionName,
  };
}

export function parsePresenceJson(raw: string | null | undefined): PresenceState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<PresenceState>;
    if (!data.licenseKey || !data.currentMood) return null;
    return normalizePresenceState(data as PresenceState);
  } catch {
    return null;
  }
}

export function serializePresenceState(state: PresenceState): string {
  return JSON.stringify(normalizePresenceState(state));
}

export function normalizePresenceState(state: PresenceState): PresenceState {
  return {
    licenseKey: state.licenseKey,
    currentMood: state.currentMood,
    moodHistory: (state.moodHistory || []).slice(-MAX_HISTORY),
    lastCheckIn: state.lastCheckIn || new Date().toISOString(),
    guidanceQueue: (state.guidanceQueue || []).slice(-MAX_GUIDANCE),
    companionName: state.companionName?.trim() || "Buddy",
  };
}

export function applyMoodUpdate(
  state: PresenceState,
  mood: BuddyMood,
  options?: { guidanceText?: string },
): PresenceState {
  const now = new Date().toISOString();
  const next: PresenceState = {
    ...state,
    currentMood: mood,
    lastCheckIn: now,
    moodHistory: [...state.moodHistory, { mood, at: now }].slice(-MAX_HISTORY),
    guidanceQueue: [...state.guidanceQueue],
  };

  if (options?.guidanceText) {
    next.guidanceQueue = [
      ...next.guidanceQueue,
      { text: options.guidanceText, at: now, priority: mood === "concerned" ? 2 : 1 },
    ].slice(-MAX_GUIDANCE);
  }

  return normalizePresenceState(next);
}

export function moodNeedsCheckIn(state: PresenceState): boolean {
  if (state.currentMood !== "concerned") return false;
  const recent = state.moodHistory.slice(-4);
  return recent.length >= 3 && recent.every((e) => e.mood === "concerned");
}

export function checkInNotificationBody(state: PresenceState): string {
  if (moodNeedsCheckIn(state)) {
    return "You seemed stressed earlier. Take a breath?";
  }
  return "Your Buddy noticed you were quiet today. Everything okay?";
}

export const MOOD_BADGE_COLORS: Record<BuddyMood, string> = {
  neutral: "#7c3aed",
  happy: "#f59e0b",
  thinking: "#3b82f6",
  concerned: "#ef4444",
  excited: "#ec4899",
  sleepy: "#6366f1",
};
