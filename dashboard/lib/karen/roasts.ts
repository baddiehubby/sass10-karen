/**
 * Brutal dialogue library — TikTok-native slang + psychological devastation.
 * Mid-quiz: callback wit → Roast Ladder (L1/L2/L3) → progressive mood.
 */

import { findCallbackRoast } from "@/lib/karen/callbacks";
import {
  applyDeltas,
  dominantTrait,
  getAnswer,
  getQuestion,
  type TraitId,
  type TraitScores,
  type UserHistoryEntry,
} from "@/lib/karen/game-engine";

export type RoastMood = "ANGRY" | "SARCASTIC" | "PROUD" | "FURIOUS";

/** Roast Ladder severity — Light → Medium → Brutal. */
export type RoastLadderLevel = 1 | 2 | 3;

export type RoastResult = {
  text: string;
  mood: RoastMood;
  trait: TraitId;
  /** True when a contradiction callback fired. */
  callback?: boolean;
  ladder?: RoastLadderLevel;
};

export type Verdict = {
  title: string;
  roast: string;
  trait: TraitId;
  score: number;
  mood: RoastMood;
};

/** Highest-score titles + punchlines (thresholds at 80+ preferred). */
export const VERDICT_LIBRARY: Record<
  TraitId,
  { title: string; roast: string; midTitle: string; midRoast: string; lowTitle: string; lowRoast: string }
> = {
  overthinking: {
    title: "MAIN CHARACTER DELULU",
    roast:
      "You are so delulu it's actually concerning. Your brain is a hamster wheel and the hamster is dead.",
    midTitle: "THE MENTAL GROUPCHAT",
    midRoast:
      "You ran a whole trial in your head, cast yourself as both lawyer and victim, and still lost.",
    lowTitle: "SOFT LAUNCH SPIRALER",
    lowRoast: "Mild delulu. Cute. Still unpaid overtime for your anxiety.",
  },
  laziness: {
    title: "NEGATIVE AURA FARMER",
    roast:
      "Your aura points are in the negative. You are radiating pure 'I haven't showered in two days' energy.",
    midTitle: "THE EFFORT NPC",
    midRoast:
      "You don't rest. You just pause the plot and hope the universe writes your arc for you.",
    lowTitle: "SNOOZE-CORE",
    lowRoast: "You moved just enough to gaslight yourself into feeling productive. No.",
  },
  chaos: {
    title: "WALKING ALGORITHM",
    roast:
      "You don't have a personality. You just have a collection of TikTok sounds and trauma.",
    midTitle: "NOTIFICATION MENACE",
    midRoast:
      "Your life is twelve unfinished tabs arguing in a group chat nobody asked to join.",
    lowTitle: "SOFT CHAOS ERA",
    lowRoast: "Mild chaos — still giving 'opened the app for a second' forever.",
  },
};

function moodFor(trait: TraitId, score: number): RoastMood {
  if (score > 80) return trait === "laziness" ? "ANGRY" : "SARCASTIC";
  if (score < 35) return "PROUD";
  return "SARCASTIC";
}

/**
 * Progressive anger across the free 9 — hooks addiction before the cliffhanger.
 * Q1–3 SARCASTIC → Q4–6 ANGRY → Q7–9 FURIOUS.
 */
export function progressiveMood(questionIndex: number, fallback: RoastMood): RoastMood {
  if (questionIndex >= 6) return "FURIOUS";
  if (questionIndex >= 3) return "ANGRY";
  if (fallback === "PROUD") return "SARCASTIC";
  return fallback === "FURIOUS" ? "SARCASTIC" : fallback;
}

/**
 * Roast Ladder from question index (0-based).
 * L1 light (Q1–3) → L2 medium (Q4–6) → L3 brutal (Q7–9).
 */
export function roastLadderLevel(questionIndex: number): RoastLadderLevel {
  if (questionIndex >= 6) return 3;
  if (questionIndex >= 3) return 2;
  return 1;
}

/**
 * Title + final roast from the highest trait score.
 * Prefers the brutal >80 lines when that trait leads.
 */
export function getVerdict(scores: TraitScores): Verdict {
  const trait = dominantTrait(scores);
  const score = scores[trait];
  const pack = VERDICT_LIBRARY[trait];

  let title = pack.lowTitle;
  let roast = pack.lowRoast;
  if (score > 80) {
    title = pack.title;
    roast = pack.roast;
  } else if (score >= 50) {
    title = pack.midTitle;
    roast = pack.midRoast;
  }

  return {
    title,
    roast,
    trait,
    score,
    mood: moodFor(trait, score),
  };
}

/** @deprecated Prefer getVerdict — kept for result-profile / older callers. */
export function getFinalRoast(scores: TraitScores): RoastResult {
  const v = getVerdict(scores);
  return { text: v.roast, mood: v.mood, trait: v.trait };
}

/* -------------------------------------------------------------------------- */
/* Roast Ladder — each answer has [light, medium, brutal]                      */
/* -------------------------------------------------------------------------- */

/** Exactly 3 lines per answer: Level 1 / 2 / 3. */
export type LadderLines = readonly [string, string, string];

export const ANSWER_ROASTS: Record<string, Record<string, LadderLines>> = {
  q1_gym: {
    a: [
      "Oh, you're one of those. 'Too tired' — noted in the file.",
      "That's genuinely embarrassing. I'm embarrassed for your aura.",
      "I would tell you to touch grass, but the grass might reject you.",
    ],
    b: [
      "Mental gym era? Soft launch of delulu fitness.",
      "Imaginary reps don't count. Your credibility just failed a PR check.",
      "You burned zero calories and somehow still lost aura points. Iconic.",
    ],
    c: [
      "Forgot, then spiraled. That's chaos with a plot armor request.",
      "You didn't skip the gym. You staged a trauma reel about skipping it.",
      "Your brain held a TED Talk on forgetting. The gym still doesn't care.",
    ],
  },
  q2_couch: {
    a: [
      "Couch all day. Main character of the horizontal timeline.",
      "Your cushion has more plot progression than you. Sit with that.",
      "Negative aura farming from a sofa. The sofa is winning.",
    ],
    b: [
      "Five starts, zero finishes. Soft chaos cosplay.",
      "You collected beginnings like they're achievements. They're not.",
      "Your to-do list is a graveyard and you're the groundskeeper who never shows up.",
    ],
    c: [
      "Overplanned Monday until today ghosted you. Classic delulu logistics.",
      "You scheduled a whole personality and forgot to live the day.",
      "Monday isn't your villain. Your planning addiction is.",
    ],
  },
  q3_deadline: {
    a: [
      "Fifth plan rewrite. Oh, you're one of those.",
      "You optimized the strategy until the work died of neglect. Embarrassing.",
      "The deadline clocked you. You clocked nothing. Touch the file.",
    ],
    b: [
      "Seven tabs that aren't the task. Soft launch of chaos.",
      "You opened the internet instead of the assignment. Brave. Useless.",
      "Your attention span filed a missing-person report and TikTok answered.",
    ],
    c: [
      "'Never that important' — soft quit energy detected.",
      "You renegotiated reality so you wouldn't have to finish. Cute. Pathetic.",
      "You cancelled the deadline in your head. Reality did not get the memo.",
    ],
  },
  q4_message: {
    a: [
      "Twelve drafts, zero sends. Delulu communication era.",
      "You workshopped courage until it expired. I'm secondhand cringing.",
      "Your groupchat with yourself needs a moderator. Spoiler: it's me.",
    ],
    b: [
      "Ghosting a human to organize socks. Priorities inverted.",
      "Chaos cleaning while a conversation burns. That's not healing. That's staging.",
      "You left them on read and deep-cleaned a drawer. Therapy couldn't write this.",
    ],
    c: [
      "Doomscroll until it solves itself — lazy with Wi-Fi.",
      "You outsourced adulthood to an algorithm. It declined your request.",
      "The problem didn't vanish. Your dignity did. Scroll responsibly.",
    ],
  },
  q5_morning: {
    a: [
      "Snooze diplomacy. Oh, you're one of those.",
      "You negotiated with a clock and lost. That's genuinely embarrassing.",
      "Dignity filed for bankruptcy before breakfast. The alarm owns you.",
    ],
    b: [
      "Five apps before standing. Soft phone-addict launch.",
      "Your thumbs woke up. Your spine clocked in late. Embarrassing.",
      "You doomscrolled yourself into being late and called it a morning routine. No.",
    ],
    c: [
      "Replaying failures as an alarm. Delulu historian energy.",
      "Guilt isn't a schedule. But go off, unpaid therapist of yourself.",
      "You time-traveled into yesterday's shame and still showed up late. Brutal.",
    ],
  },
  q6_social: {
    a: [
      "Yes, then cancel. Soft flake era.",
      "Last-minute cancellation is your signature. Trademark pending. Embarrassing.",
      "You treat plans like drafts you never publish. Friendship left the chat.",
    ],
    b: [
      "You showed up in body. Your phone showed up as your personality.",
      "Present but scrolling — modern ghosting while seated. Cringe.",
      "Your friends got the NPC version of you. The real you is in Reels.",
    ],
    c: [
      "Overanalyzing a hangout invite. Soft delulu detected.",
      "The invite wasn't a thesis. Calm down, professor of awkward.",
      "You turned friendship into homework and still failed the assignment.",
    ],
  },
  q7_night: {
    a: [
      "'Educational' episode at 1 AM. Sure, scholar.",
      "One more episode is how regret soft-launches. Embarrassing.",
      "Your pillow filed a restraining order. Netflix is not a personality.",
    ],
    b: [
      "Life plans in Notes at 1 AM. Delulu night shift.",
      "You planned a better morning by destroying tonight. Genius. Pathetic.",
      "Your Notes app is a graveyard of futures you'll never clock into.",
    ],
    c: [
      "'For a second' lasted three hours. Soft chaos math.",
      "TikTok ate your bedtime and left crumbs as your personality.",
      "You don't have a sleep schedule. You have a For You page with trauma.",
    ],
  },
  q8_busy: {
    a: [
      "'Too busy' — oh, you're one of those.",
      "Busy doing what, exactly? Existing loudly? Embarrassing.",
      "Your calendar is full of nothing and somehow still overbooked. Aura debt.",
    ],
    b: [
      "Waiting for motivation like it's Amazon Prime. Soft delulu.",
      "Motivation isn't arriving. You're waiting for a different personality.",
      "I would tell you to touch grass, but motivation already bounced you.",
    ],
    c: [
      "'Starting Monday' — recycled plot line detected.",
      "Monday has heard this bit before. It's not laughing with you.",
      "You soft-launched discipline for the 40th time. The gym blocked you.",
    ],
  },
  q9_excuse: {
    a: [
      "'Productive later' — classic soft quit.",
      "Later-you just texted: they're also lazy. Shocking. Embarrassing.",
      "'Later' is how never gets a PR makeover. Touch grass. Or don't — grass might reject you.",
    ],
    b: [
      "Strategic rest without a strategy is horizontal quitting.",
      "You rebranded avoidance as recovery. Marketing would be proud. I'm not.",
      "Negative aura points for calling a couch nap a protocol. Sit down.",
    ],
    c: [
      "Tomorrow-you is already tired of today's promises.",
      "You keep outsourcing adulthood to a future that never clocks in.",
      "Tomorrow-you ghosted you. Present-you is the problem. Brutal, but true.",
    ],
  },
};

function ladderLine(pool: LadderLines, level: RoastLadderLevel): string {
  return pool[level - 1]!;
}

const QUESTION_ORDER = [
  "q1_gym",
  "q2_couch",
  "q3_deadline",
  "q4_message",
  "q5_morning",
  "q6_social",
  "q7_night",
  "q8_busy",
  "q9_excuse",
] as const;

/**
 * Punchy insult for the immediate choice.
 * Prefers contradiction callbacks; else climbs the Roast Ladder by question index.
 */
export function getRoast(
  questionId: string,
  answerId: string,
  currentScores: TraitScores,
  history: readonly UserHistoryEntry[] = [],
): RoastResult {
  const question = getQuestion(questionId);
  const answer = getAnswer(questionId, answerId);
  if (!question || !answer) {
    return {
      text: "Even your answers are invalid. Try existing harder.",
      mood: "ANGRY",
      trait: "chaos",
    };
  }

  const next = applyDeltas(currentScores, answer.deltas);
  const trait = dominantTrait(next);
  const qIndex = Math.max(
    0,
    QUESTION_ORDER.indexOf(questionId as (typeof QUESTION_ORDER)[number]),
  );
  const ladder = roastLadderLevel(qIndex);

  const callback = findCallbackRoast(questionId, answerId, history);
  if (callback) {
    return {
      text: callback.replace(/\s+/g, " ").trim(),
      mood: progressiveMood(qIndex, "FURIOUS"),
      trait,
      callback: true,
      ladder: 3,
    };
  }

  const pool = ANSWER_ROASTS[questionId]?.[answerId];
  const text = pool
    ? ladderLine(pool, ladder)
    : getVerdict(next).roast;

  return {
    text: text.replace(/\s+/g, " ").trim(),
    mood: progressiveMood(qIndex, moodFor(trait, next[trait])),
    trait,
    ladder,
  };
}
