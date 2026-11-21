/**
 * Premium Goal Tracker / Accountability Loop — localStorage + optional Prisma mirror.
 * Evening interrogation arms at local 8:00 PM.
 */

export type AccountabilityGoalId = "gym" | "work" | "sleep" | "custom";

export type AccountabilityGoals = Record<"gym" | "work" | "sleep", boolean>;

export type AccountabilityState = {
  /** Local calendar day key YYYY-MM-DD */
  day: string;
  /** Legacy toggles (still honored if set). */
  goals: AccountabilityGoals;
  /** Free-text Goal Tracker — VIP $19/mo core. */
  mainGoal: string;
  wakeUpTime: string;
  commitment: string;
  /** Day the evening check-in was completed (prevents re-prompt). */
  checkInCompletedDay: string | null;
};

export const ACCOUNTABILITY_STORAGE_KEY = "karen.accountability.v1";

export const ACCOUNTABILITY_GOAL_META: Array<{
  id: "gym" | "work" | "sleep";
  label: string;
  question: string;
}> = [
  { id: "gym", label: "Gym", question: "Did you go to the gym today?" },
  { id: "work", label: "Work", question: "Did you actually finish your work today?" },
  {
    id: "sleep",
    label: "Sleep",
    question: "Did you protect your sleep like it mattered?",
  },
];

/** Slightly impressed YES — Kokoro / TTS. */
export const CHECKIN_YES_LINE =
  "Fine. You actually did it. Don't let it go to your head.";

/** Brutal NO — Kokoro / TTS. */
export const CHECKIN_NO_LINE =
  "I knew it. You're a coward. Tomorrow, you better not show your face here unless you actually do it.";

/** Preferred Kokoro WAVs for the YES / NO consequence. */
export const CHECKIN_YES_AUDIO_SRC = "/audio/smackbacks/sb_49.wav";
export const CHECKIN_NO_AUDIO_SRC = "/audio/smackbacks/angry_05.wav";

export const EMPTY_GOALS: AccountabilityGoals = {
  gym: false,
  work: false,
  sleep: false,
};

/** Local calendar day (not UTC) — evening check-in is local 8 PM. */
export function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isPastEveningCheckInHour(d = new Date(), hour = 20): boolean {
  return d.getHours() > hour || (d.getHours() === hour && d.getMinutes() >= 0);
}

export function defaultAccountabilityState(day = localDayKey()): AccountabilityState {
  return {
    day,
    goals: { ...EMPTY_GOALS },
    mainGoal: "",
    wakeUpTime: "07:00",
    commitment: "",
    checkInCompletedDay: null,
  };
}

function normalizeGoals(raw: Partial<AccountabilityGoals> | undefined): AccountabilityGoals {
  return {
    gym: Boolean(raw?.gym),
    work: Boolean(raw?.work),
    sleep: Boolean(raw?.sleep),
  };
}

export function readAccountabilityState(): AccountabilityState {
  if (typeof window === "undefined") return defaultAccountabilityState();
  try {
    const raw = window.localStorage.getItem(ACCOUNTABILITY_STORAGE_KEY);
    if (!raw) return defaultAccountabilityState();
    const parsed = JSON.parse(raw) as Partial<AccountabilityState>;
    const today = localDayKey();
    return {
      day: today,
      goals: normalizeGoals(parsed.goals),
      mainGoal: typeof parsed.mainGoal === "string" ? parsed.mainGoal : "",
      wakeUpTime:
        typeof parsed.wakeUpTime === "string" && /^\d{2}:\d{2}$/.test(parsed.wakeUpTime)
          ? parsed.wakeUpTime
          : "07:00",
      commitment: typeof parsed.commitment === "string" ? parsed.commitment : "",
      checkInCompletedDay: parsed.checkInCompletedDay === today ? today : null,
    };
  } catch {
    return defaultAccountabilityState();
  }
}

export const MAIN_GOAL_MAX_LEN = 120;
export const COMMITMENT_MAX_LEN = 160;

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Coerce ANY value into a safe AccountabilityState (trimmed, length-capped,
 * validated clock/day). Pure + server-safe: used by localStorage writes AND by
 * the Prisma server action, which receives untrusted client input.
 */
export function sanitizeAccountabilityState(
  raw: unknown,
  fallbackDay = localDayKey(),
): AccountabilityState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<AccountabilityState>;
  const text = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  const day = (v: unknown) => (typeof v === "string" && DAY_KEY_RE.test(v) ? v : null);
  return {
    day: day(r.day) ?? fallbackDay,
    goals: normalizeGoals(r.goals),
    mainGoal: text(r.mainGoal, MAIN_GOAL_MAX_LEN),
    wakeUpTime:
      typeof r.wakeUpTime === "string" && CLOCK_RE.test(r.wakeUpTime)
        ? r.wakeUpTime
        : "07:00",
    commitment: text(r.commitment, COMMITMENT_MAX_LEN),
    checkInCompletedDay: day(r.checkInCompletedDay),
  };
}

export function writeAccountabilityState(state: AccountabilityState): AccountabilityState {
  const next: AccountabilityState = {
    ...sanitizeAccountabilityState(state),
    day: localDayKey(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ACCOUNTABILITY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }
  return next;
}

export function selectedGoalIds(goals: AccountabilityGoals): Array<"gym" | "work" | "sleep"> {
  return ACCOUNTABILITY_GOAL_META.map((g) => g.id).filter((id) => goals[id]);
}

/** True when the Goal Tracker (or legacy toggles) has something to interrogate. */
export function hasTrackableGoal(state: AccountabilityState): boolean {
  if (state.commitment.trim() || state.mainGoal.trim()) return true;
  return selectedGoalIds(state.goals).length > 0;
}

/**
 * Question for the 8 PM modal.
 * Prefer Commitment → Main Goal → legacy gym/work/sleep labels.
 */
export function primaryCheckInQuestion(state: AccountabilityState | AccountabilityGoals): {
  id: AccountabilityGoalId;
  goalLabel: string;
  question: string;
} {
  // Legacy call sites passed only goals.
  const full: AccountabilityState =
    "commitment" in (state as AccountabilityState) || "mainGoal" in (state as AccountabilityState)
      ? (state as AccountabilityState)
      : {
          ...defaultAccountabilityState(),
          goals: state as AccountabilityGoals,
        };

  const commitment = full.commitment.trim();
  const mainGoal = full.mainGoal.trim();
  if (commitment || mainGoal) {
    const label = commitment || mainGoal;
    return {
      id: "custom",
      goalLabel: label,
      question: `Did you actually do ${label} today?`,
    };
  }

  const selected = selectedGoalIds(full.goals);
  const id = selected[0] ?? "gym";
  const meta = ACCOUNTABILITY_GOAL_META.find((g) => g.id === id)!;
  return { id: meta.id, goalLabel: meta.label, question: meta.question };
}

/** True when it's after 8 PM, a goal exists, and check-in not done today. */
export function shouldActivateEveningCheckIn(
  state: AccountabilityState,
  now = new Date(),
): boolean {
  if (!isPastEveningCheckInHour(now)) return false;
  if (state.checkInCompletedDay === localDayKey(now)) return false;
  return hasTrackableGoal(state);
}
