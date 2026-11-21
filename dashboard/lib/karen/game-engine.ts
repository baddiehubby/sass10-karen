/**
 * Local deterministic Karen Roast Game — zero LLM / API cost.
 * Free run: 9 roasted questions → Q10 cliffhanger paywall.
 */

export type TraitId = "overthinking" | "chaos" | "laziness";

export type TraitScores = {
  overthinking: number;
  chaos: number;
  laziness: number;
};

export type QuestionOption = {
  text: string;
  scores: {
    overthinking: number;
    laziness: number;
    chaos: number;
  };
};

export type Question = {
  id: string;
  text: string;
  options: [QuestionOption, QuestionOption, QuestionOption];
};

/** Answerable free questions (Q1–Q9). Q10 is the cliffhanger paywall beat. */
export const FREE_ROAST_QUESTION_COUNT = 9;
/** HUD length including the locked psychological breakdown. */
export const INTERROGATION_STAGE_COUNT = 10;

/**
 * 9 provocative questions tuned for contradiction callbacks.
 * Per-option deltas kept mid so 9 answers still differentiate traits.
 */
export const QUESTIONS: readonly Question[] = [
  {
    id: "q1_gym",
    text: "Why didn't you go to the gym today?",
    options: [
      {
        text: "I was too tired",
        scores: { laziness: 32, overthinking: 4, chaos: 4 },
      },
      {
        text: "I did a home workout (in my head)",
        scores: { chaos: 22, laziness: 8, overthinking: 12 },
      },
      {
        text: "I forgot — then spiraled about forgetting",
        scores: { overthinking: 18, chaos: 28, laziness: 8 },
      },
    ],
  },
  {
    id: "q2_couch",
    text: "Be honest — what did your afternoon look like?",
    options: [
      {
        text: "I sat on the couch all day",
        scores: { laziness: 34, chaos: 8, overthinking: 4 },
      },
      {
        text: "Started five things. Finished none.",
        scores: { chaos: 32, overthinking: 8, laziness: 10 },
      },
      {
        text: "Overplanned Monday until the day vanished",
        scores: { overthinking: 34, laziness: 8, chaos: 6 },
      },
    ],
  },
  {
    id: "q3_deadline",
    text: "Your deadline is in two hours. What are you doing?",
    options: [
      {
        text: "Rewriting the plan for the fifth time",
        scores: { overthinking: 32, laziness: 8, chaos: 6 },
      },
      {
        text: "Opening seven tabs that aren't the task",
        scores: { chaos: 34, overthinking: 8, laziness: 10 },
      },
      {
        text: "Convincing myself it was never that important",
        scores: { laziness: 30, overthinking: 12, chaos: 6 },
      },
    ],
  },
  {
    id: "q4_message",
    text: "Someone texts \"we need to talk.\" You…",
    options: [
      {
        text: "Draft twelve replies and send none",
        scores: { overthinking: 36, laziness: 4, chaos: 8 },
      },
      {
        text: "Leave them on read and deep-clean a drawer",
        scores: { chaos: 26, laziness: 18, overthinking: 8 },
      },
      {
        text: "Doomscroll until the problem solves itself",
        scores: { laziness: 28, chaos: 16, overthinking: 10 },
      },
    ],
  },
  {
    id: "q5_morning",
    text: "Your alarm went off. Reality check — what happened?",
    options: [
      {
        text: "Snoozed until my dignity filed for bankruptcy",
        scores: { laziness: 34, overthinking: 6, chaos: 8 },
      },
      {
        text: "Checked five apps before my feet hit the floor",
        scores: { chaos: 30, overthinking: 12, laziness: 8 },
      },
      {
        text: "Replayed yesterday's failures until I was late",
        scores: { overthinking: 34, laziness: 10, chaos: 4 },
      },
    ],
  },
  {
    id: "q6_social",
    text: "Friends invite you out. You…",
    options: [
      {
        text: "Say yes, then cancel last minute",
        scores: { chaos: 24, laziness: 16, overthinking: 12 },
      },
      {
        text: "Go — but check your phone the whole time",
        scores: { chaos: 28, laziness: 10, overthinking: 10 },
      },
      {
        text: "Overanalyze the invite until it's awkward",
        scores: { overthinking: 34, chaos: 8, laziness: 6 },
      },
    ],
  },
  {
    id: "q7_night",
    text: "It's 1 AM. Why are you still awake?",
    options: [
      {
        text: "One more episode. It's educational.",
        scores: { laziness: 28, chaos: 18, overthinking: 4 },
      },
      {
        text: "Rewriting my entire life plan in Notes",
        scores: { overthinking: 34, chaos: 10, laziness: 8 },
      },
      {
        text: "I opened TikTok \"for a second\"",
        scores: { chaos: 34, laziness: 14, overthinking: 4 },
      },
    ],
  },
  {
    id: "q8_busy",
    text: "Why didn't you work out this week?",
    options: [
      {
        text: "Too busy to work out",
        scores: { laziness: 22, chaos: 12, overthinking: 14 },
      },
      {
        text: "Still waiting for motivation to arrive",
        scores: { laziness: 30, overthinking: 12, chaos: 8 },
      },
      {
        text: "Starting Monday. For real this time.",
        scores: { chaos: 20, laziness: 22, overthinking: 10 },
      },
    ],
  },
  {
    id: "q9_excuse",
    text: "Pick your favorite lie to yourself.",
    options: [
      {
        text: "I'll be productive later",
        scores: { laziness: 28, overthinking: 10, chaos: 10 },
      },
      {
        text: "I'm just resting strategically",
        scores: { laziness: 32, overthinking: 12, chaos: 6 },
      },
      {
        text: "Tomorrow-me will fix everything",
        scores: { overthinking: 22, laziness: 20, chaos: 14 },
      },
    ],
  },
] as const;

export type UserHistoryEntry = {
  questionId: string;
  /** Option index 0–2 */
  optionId: number;
  /** "a" | "b" | "c" */
  answerId: string;
  label: string;
};

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function emptyScores(): TraitScores {
  return { overthinking: 0, chaos: 0, laziness: 0 };
}

export function clampScores(scores: TraitScores): TraitScores {
  return {
    overthinking: clamp100(scores.overthinking),
    chaos: clamp100(scores.chaos),
    laziness: clamp100(scores.laziness),
  };
}

export type AnswerSelection = {
  questionId: string;
  /** Option index 0–2, or legacy "a" | "b" | "c". */
  optionId: number | string;
};

function optionIndex(optionId: number | string): number {
  if (typeof optionId === "number") return optionId;
  const map: Record<string, number> = { a: 0, b: 1, c: 2 };
  if (optionId in map) return map[optionId]!;
  const n = Number(optionId);
  return Number.isFinite(n) ? n : -1;
}

export function answerLetter(optionId: number | string): string {
  const idx = optionIndex(optionId);
  return OPTION_IDS[idx] ?? "a";
}

export function getQuestion(questionId: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === questionId);
}

/**
 * Sum selected option score deltas, clamp each trait to 0–100.
 */
export function calculateResults(answers: AnswerSelection[]): TraitScores {
  const totals = emptyScores();

  for (const ans of answers) {
    const q = getQuestion(ans.questionId);
    if (!q) continue;
    const idx = optionIndex(ans.optionId);
    const opt = q.options[idx];
    if (!opt) continue;
    totals.overthinking += opt.scores.overthinking;
    totals.laziness += opt.scores.laziness;
    totals.chaos += opt.scores.chaos;
  }

  return clampScores(totals);
}

export function dominantTrait(scores: TraitScores): TraitId {
  const entries: Array<[TraitId, number]> = [
    ["overthinking", scores.overthinking],
    ["chaos", scores.chaos],
    ["laziness", scores.laziness],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]![0];
}

export function applyDeltas(
  scores: TraitScores,
  deltas: Partial<TraitScores>,
): TraitScores {
  return clampScores({
    overthinking: scores.overthinking + (deltas.overthinking ?? 0),
    chaos: scores.chaos + (deltas.chaos ?? 0),
    laziness: scores.laziness + (deltas.laziness ?? 0),
  });
}

/* -------------------------------------------------------------------------- */
/* UI compatibility — roast client expects prompt / answers / PersonalityEngine */
/* -------------------------------------------------------------------------- */

export type TraitDelta = Partial<TraitScores>;

export type RoastAnswer = {
  id: string;
  label: string;
  deltas: TraitDelta;
};

export type RoastQuestion = {
  id: string;
  prompt: string;
  answers: [RoastAnswer, RoastAnswer, RoastAnswer];
};

const OPTION_IDS = ["a", "b", "c"] as const;

export const ROAST_QUESTIONS: readonly RoastQuestion[] = QUESTIONS.map((q) => ({
  id: q.id,
  prompt: q.text,
  answers: q.options.map((opt, i) => ({
    id: OPTION_IDS[i]!,
    label: opt.text,
    deltas: { ...opt.scores },
  })) as [RoastAnswer, RoastAnswer, RoastAnswer],
}));

export function getAnswer(
  questionId: string,
  answerId: string,
): RoastAnswer | undefined {
  const q = ROAST_QUESTIONS.find((x) => x.id === questionId);
  return q?.answers.find((a) => a.id === answerId);
}

/** Hidden mood axis — not shown in the HUD; drives screaming / quiet spells. */
export const KAREN_RAGE_MIN = 0;
export const KAREN_RAGE_MAX = 100;
export const KAREN_RAGE_START = 45;
/** Interaction delta range: −10 … +20. */
export const KAREN_RAGE_DELTA_MIN = -10;
export const KAREN_RAGE_DELTA_MAX = 20;
/** Above this → ignore keywords, scream, refuse the mic. */
export const KAREN_RAGE_SCREAM_THRESHOLD = 80;
/** Below this → dangerously quiet; mic locks. */
export const KAREN_RAGE_QUIET_THRESHOLD = 20;

export type KarenMoodMode = "normal" | "scream" | "quiet";

export type KarenInteractionMood = {
  rage: number;
  delta: number;
  mode: KarenMoodMode;
  /** Exact same line said twice in a row. */
  repeated: boolean;
  normalizedLine: string;
};

function clampRage(n: number): number {
  if (!Number.isFinite(n)) return KAREN_RAGE_START;
  return Math.max(KAREN_RAGE_MIN, Math.min(KAREN_RAGE_MAX, Math.round(n)));
}

/** Normalize for repeat detection — lowercase, collapsed whitespace. */
export function normalizeCombatLine(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Random rage swing for one user interaction (−10 … +20).
 * Inject `rng` in tests (`() => 0` → −10, `() => 1` → +20).
 */
export function rollRageDelta(rng: () => number = Math.random): number {
  const t = Math.min(1, Math.max(0, rng()));
  const span = KAREN_RAGE_DELTA_MAX - KAREN_RAGE_DELTA_MIN;
  return Math.round(KAREN_RAGE_DELTA_MIN + t * span);
}

export function moodModeFromRage(rage: number): KarenMoodMode {
  if (rage > KAREN_RAGE_SCREAM_THRESHOLD) return "scream";
  if (rage < KAREN_RAGE_QUIET_THRESHOLD) return "quiet";
  return "normal";
}

/**
 * Tracks trait scores + userHistory across the free roast run.
 * Also exposes the accountability `goodStreak` (localStorage) for praise mood.
 * Hidden `karenRageLevel` makes her feel unhinged without an LLM.
 */
export class PersonalityEngine {
  private scores: TraitScores;
  private answered = new Set<string>();
  private history: AnswerSelection[] = [];
  private userHistory: UserHistoryEntry[] = [];
  /** Hidden 0–100 mood — fluctuates every interaction. */
  private karenRageLevel = KAREN_RAGE_START;
  /** Last combat line the user spoke (for broken-record detection). */
  private lastCombatLine = "";

  constructor(initial: TraitScores = emptyScores()) {
    this.scores = clampScores(initial);
  }

  getScores(): TraitScores {
    return { ...this.scores };
  }

  /** Hidden rage meter (not on the fighting HUD). */
  getRageLevel(): number {
    return this.karenRageLevel;
  }

  /** Prior answers — fuel for callback / contradiction roasts. */
  getUserHistory(): UserHistoryEntry[] {
    return this.userHistory.map((h) => ({ ...h }));
  }

  get questions(): readonly Question[] {
    return QUESTIONS;
  }

  get currentQuestionIndex(): number {
    return this.answered.size;
  }

  get currentQuestion(): Question | null {
    return QUESTIONS[this.answered.size] ?? null;
  }

  get isComplete(): boolean {
    return this.answered.size >= QUESTIONS.length;
  }

  /** Consecutive successful evening check-ins (localStorage). */
  get goodStreak(): number {
    if (typeof window === "undefined") return 0;
    try {
      const n = Number(window.localStorage.getItem("karen.goodStreak") || "0");
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch {
      return 0;
    }
  }

  /** True when streak ≥ 7 — Karen shifts to PROUD / slightly nice sarcasm. */
  get isPraiseMode(): boolean {
    return this.goodStreak >= 7;
  }

  /**
   * Mood tag for the current streak state.
   * ≥7 → [PROUD]; otherwise roast defaults stay [FURIOUS]/[SARCASTIC].
   */
  getStreakMood(): "PROUD" | "SARCASTIC" | "FURIOUS" {
    if (this.isPraiseMode) return "PROUD";
    return "FURIOUS";
  }

  reset(): void {
    this.scores = emptyScores();
    this.answered.clear();
    this.history = [];
    this.userHistory = [];
    this.karenRageLevel = KAREN_RAGE_START;
    this.lastCombatLine = "";
  }

  /**
   * Every user interaction swings `karenRageLevel` by −10…+20.
   * Quiz taps, mic presses, and typed insults all call this.
   */
  fluctuateRage(rng: () => number = Math.random): number {
    const delta = rollRageDelta(rng);
    this.karenRageLevel = clampRage(this.karenRageLevel + delta);
    return this.karenRageLevel;
  }

  /**
   * Record a combat line + fluctuate rage.
   * Sets `repeated` when the exact same normalized line was just said.
   */
  registerCombatInteraction(
    transcript: string,
    rng: () => number = Math.random,
  ): KarenInteractionMood {
    const normalizedLine = normalizeCombatLine(transcript);
    const repeated =
      Boolean(normalizedLine) && normalizedLine === this.lastCombatLine;
    if (normalizedLine) this.lastCombatLine = normalizedLine;

    const before = this.karenRageLevel;
    const rage = this.fluctuateRage(rng);
    const delta = rage - before;

    // Broken-record always enrages her hard so Mute Protocol feels earned.
    if (repeated) {
      this.karenRageLevel = clampRage(Math.max(rage, KAREN_RAGE_SCREAM_THRESHOLD + 5));
    }

    const finalRage = this.karenRageLevel;
    return {
      rage: finalRage,
      delta,
      mode: repeated ? "scream" : moodModeFromRage(finalRage),
      repeated,
      normalizedLine,
    };
  }

  /** Apply a mid-run trait bump (e.g. Smack Back → Chaos +5). */
  bumpTrait(trait: TraitId, amount: number): TraitScores {
    this.scores = clampScores({
      ...this.scores,
      [trait]: this.scores[trait] + amount,
    });
    return this.getScores();
  }

  answer(questionId: string, answerId: string | number): TraitScores {
    if (this.answered.has(questionId)) {
      throw new Error(`Question already answered: ${questionId}`);
    }
    const q = getQuestion(questionId);
    const idx = optionIndex(answerId);
    if (!q || !q.options[idx]) {
      throw new Error(`Unknown answer ${answerId} for ${questionId}`);
    }
    const letter = OPTION_IDS[idx]!;
    const label = q.options[idx]!.text;
    this.history.push({ questionId, optionId: idx });
    this.userHistory.push({
      questionId,
      optionId: idx,
      answerId: letter,
      label,
    });
    this.answered.add(questionId);
    this.scores = calculateResults(this.history);
    return this.getScores();
  }
}
