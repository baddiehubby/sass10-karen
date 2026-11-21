/**
 * Contextual Callback / Wit Engine — catch contradictions across the run.
 */

import type { UserHistoryEntry } from "@/lib/karen/game-engine";

export type CallbackRule = {
  id: string;
  /** Prior answer that must exist in history. */
  prior: { questionId: string; answerId: string };
  /** Current answer that triggers the callback. */
  current: { questionId: string; answerId: string };
  line: string;
};

/** Ten contradiction callbacks — make Karen feel like she remembers. */
export const CALLBACK_ROASTS: readonly CallbackRule[] = [
  {
    id: "couch_vs_busy",
    prior: { questionId: "q2_couch", answerId: "a" },
    current: { questionId: "q8_busy", answerId: "a" },
    line: "Wait. You said you sat on the couch all day. Now you're \"too busy\"? Pick a lie and stick to it.",
  },
  {
    id: "tired_vs_busy",
    prior: { questionId: "q1_gym", answerId: "a" },
    current: { questionId: "q8_busy", answerId: "a" },
    line: "Too tired for the gym, too busy to work out — fascinating how your calendar fills with excuses.",
  },
  {
    id: "mental_gym_vs_motivation",
    prior: { questionId: "q1_gym", answerId: "b" },
    current: { questionId: "q8_busy", answerId: "b" },
    line: "You already \"worked out\" in your head. Now you're waiting for motivation? That's two imaginary gyms.",
  },
  {
    id: "couch_vs_episode",
    prior: { questionId: "q2_couch", answerId: "a" },
    current: { questionId: "q7_night", answerId: "a" },
    line: "Couch all day, then \"one more episode\" at 1 AM. Your furniture has a better routine than you.",
  },
  {
    id: "plan_day_and_night",
    prior: { questionId: "q3_deadline", answerId: "a" },
    current: { questionId: "q7_night", answerId: "b" },
    line: "You rewrote the plan before the deadline and again at 1 AM. At this point the plan is your personality.",
  },
  {
    id: "tabs_vs_tiktok",
    prior: { questionId: "q3_deadline", answerId: "b" },
    current: { questionId: "q7_night", answerId: "c" },
    line: "Seven useless tabs by day, TikTok \"for a second\" by night. Your attention span filed a missing-person report.",
  },
  {
    id: "never_important_vs_later",
    prior: { questionId: "q3_deadline", answerId: "c" },
    current: { questionId: "q9_excuse", answerId: "a" },
    line: "It \"wasn't that important,\" and you'll be \"productive later.\" Congrats — you've invented infinite postponement.",
  },
  {
    id: "drafts_vs_awkward_invite",
    prior: { questionId: "q4_message", answerId: "a" },
    current: { questionId: "q6_social", answerId: "c" },
    line: "Twelve unsent drafts, then you overanalyze a hangout invite. Your brain is a customer-service hold loop.",
  },
  {
    id: "snooze_vs_monday",
    prior: { questionId: "q5_morning", answerId: "a" },
    current: { questionId: "q8_busy", answerId: "c" },
    line: "You snoozed your dignity away this morning and still said \"starting Monday.\" Monday is laughing.",
  },
  {
    id: "couch_vs_strategic_rest",
    prior: { questionId: "q2_couch", answerId: "a" },
    current: { questionId: "q9_excuse", answerId: "b" },
    line: "Couch all day, then \"resting strategically\"? That's not strategy. That's a soft launch of giving up.",
  },
] as const;

function answered(
  history: readonly UserHistoryEntry[],
  questionId: string,
  answerId: string,
): boolean {
  return history.some((h) => h.questionId === questionId && h.answerId === answerId);
}

/**
 * Prefer a callback roast when the current answer contradicts prior history.
 * Pass history *before* the current answer is recorded.
 */
export function findCallbackRoast(
  questionId: string,
  answerId: string,
  history: readonly UserHistoryEntry[],
): string | null {
  for (const rule of CALLBACK_ROASTS) {
    if (rule.current.questionId !== questionId || rule.current.answerId !== answerId) {
      continue;
    }
    if (answered(history, rule.prior.questionId, rule.prior.answerId)) {
      return rule.line;
    }
  }
  return null;
}
