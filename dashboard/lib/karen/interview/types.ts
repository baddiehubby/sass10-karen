/**
 * Karen interviewer — shared types (Stage 1).
 *
 * Methodology adapted from WarlCang/interview-my-project (MIT).
 * Domain: daily life, habits, goals, excuses, commitments — not code review.
 * Buddy remains a separate companion; these types are Karen-only.
 */

/** User-controlled intensity. Higher allows sharper roast tone; never lifts safety bans. */
export type KarenIntensity = 1 | 2 | 3 | 4 | 5;

/**
 * Independent of Buddy's CharacterVoice.
 * Sweet ≠ Buddy-warm; Furious is theatrical comedy, not harassment.
 */
export type KarenMood = "sweet" | "sarcastic" | "annoyed" | "furious";

/** Face / avatar cue for the animated character (wired later). */
export type KarenFaceCue =
  | "smile"
  | "smirk"
  | "raised_eyebrow"
  | "eye_roll"
  | "glare"
  | "shouting"
  | "softened"
  | "neutral";

/** Life-domain probe categories (mapped from reference taxonomy). */
export type KarenProbeCategory =
  | "commitment" // load-bearing decisions
  | "tradeoff" // X-over-Y priorities
  | "failure_mode" // what breaks when they skip
  | "habit_ceiling" // scale ceilings
  | "day_flow" // data-flow tracing → day tracing
  | "avoidance" // security surface → avoidance surface
  | "glossed_struggle" // struggle they won't name
  | "excuse_pattern" // repeated agent-dependency → excuse dependency
  | "value_skepticism"; // why does this goal matter?

/** Honest verdict labels (reference: Solid / Shaky / Couldn't defend). */
export type KarenVerdict = "solid" | "shaky" | "failed";

export type KarenQuestionStatus = "queued" | "asked" | "requeued";

/** Follow-up ladder rung (reference: Surface → Push → Floor). */
export type KarenLadderRung = "surface" | "push" | "floor";

/** Three ranking axes from interview-my-project (1–5 each). */
export type KarenRankAxes = {
  loadBearing: 1 | 2 | 3 | 4 | 5;
  interviewerLikelihood: 1 | 2 | 3 | 4 | 5;
  nonObviousness: 1 | 2 | 3 | 4 | 5;
};

export type KarenProbeQuestion = {
  id: string;
  category: KarenProbeCategory;
  /** Natural conversational entry path (when to steer here). */
  entry: string;
  /** Candidate-facing question — never omniscient internals. */
  question: string;
  /** Hidden answer key / what memory says is true. */
  anchor: string;
  evidence: string;
  push: string;
  floor: string;
  /** Optional per-axis scores used to derive rankScore. */
  axes?: KarenRankAxes;
  /** Sum of three 1–5 axes; discard under 9 at bank-build time. */
  rankScore: number;
  status: KarenQuestionStatus;
  timesAsked: number;
  bestScore: KarenVerdict | null;
};

export type KarenSessionRecord = {
  date: string;
  mode: "default" | "quick" | "deep" | "focus";
  asked: number;
  completed: boolean;
  solid: number;
  shaky: number;
  failed: number;
  weakAreas: KarenProbeCategory[];
};

/**
 * Scorecard shape adapted from `.interview/scorecard.json`.
 * readiness = rank-weighted % of bank with bestScore === "solid".
 */
export type KarenScorecard = {
  schemaVersion: 1;
  sessions: KarenSessionRecord[];
  readiness: number;
  trend: string;
};

export type KarenLifeFactKind =
  | "promise"
  | "completion"
  | "avoidance"
  | "excuse"
  | "goal"
  | "daily_progress"
  | "answer";

export type KarenFactSource = "user_utterance" | "seed" | "system";

export type KarenLifeFact = {
  id: string;
  kind: KarenLifeFactKind;
  text: string;
  /** Normalized key for repeated-excuse / promise matching. */
  key: string;
  createdAt: string;
  /** How often this excuse/promise key has appeared. */
  timesSeen: number;
  lastSeenAt: string;
  relatedQuestionId?: string;
  metadata?: Record<string, string>;
  /** Where the fact came from — never treat seeds as live excuses. */
  source?: KarenFactSource;
  /** 0–1 relevance for delivery; recency bumps this, age decays it. */
  relevance?: number;
};

export type KarenTurnRecord = {
  at: string;
  role: "user" | "karen";
  text: string;
  questionId?: string;
  rung?: KarenLadderRung;
  verdict?: KarenVerdict;
  mood?: KarenMood;
};

export type KarenInterviewState = {
  schemaVersion: 1;
  userId: string;
  updatedAt: string;
  intensity: KarenIntensity;
  lastMood: KarenMood;
  questions: KarenProbeQuestion[];
  scorecard: KarenScorecard;
  facts: KarenLifeFact[];
  recentTurns: KarenTurnRecord[];
  /** Active probe id during a live session, if any. */
  activeQuestionId: string | null;
  activeRung: KarenLadderRung | null;
  /** Stage 5: fingerprint of last processed answer (questionId:normalized). */
  lastAnswerFingerprint: string | null;
  /** Stage 5: clarification pending — bank must not mutate. */
  awaitingClarification: boolean;
  /** Stage 5: question ids that already received a committed verdict this arc. */
  committedVerdictQuestionIds: string[];
};

export type KarenPersonalityConfig = {
  mood: KarenMood;
  intensity: KarenIntensity;
  /** Allow theatrical shouting / exaggerated insults at high intensity. */
  allowTheatricalRoast: boolean;
  /** Soften after user pushback or when apology is warranted. */
  allowSoften: boolean;
  /** Hard bans — never lifted by intensity. */
  banned: ReadonlyArray<"slurs" | "threats" | "identity_attacks" | "genuine_harassment">;
};

export const KAREN_DEFAULT_PERSONALITY: KarenPersonalityConfig = {
  mood: "sarcastic",
  intensity: 3,
  allowTheatricalRoast: true,
  allowSoften: true,
  banned: ["slurs", "threats", "identity_attacks", "genuine_harassment"],
};

export const KAREN_RANK_DISCARD_BELOW = 9;

export function emptyScorecard(): KarenScorecard {
  return {
    schemaVersion: 1,
    sessions: [],
    readiness: 0,
    trend: "first session",
  };
}

export function createEmptyInterviewState(userId: string, now = new Date()): KarenInterviewState {
  return {
    schemaVersion: 1,
    userId,
    updatedAt: now.toISOString(),
    intensity: 3,
    lastMood: "sarcastic",
    questions: [],
    scorecard: emptyScorecard(),
    facts: [],
    recentTurns: [],
    activeQuestionId: null,
    activeRung: null,
    lastAnswerFingerprint: null,
    awaitingClarification: false,
    committedVerdictQuestionIds: [],
  };
}
