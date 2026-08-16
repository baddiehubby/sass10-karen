/**
 * Conversational state machine — tracks continuity across turns.
 */

import type {
  BuddyEmotion,
  BuddyIntent,
  BuddyTopic,
  ConversationMachineState,
  ConversationTurn,
  EngagementState,
  InternalTurnState,
} from "@/src/intelligence/types";

export type ConversationState = {
  depth: number;
  turns: ConversationTurn[];
  lastUserText: string;
  lastBuddyText: string;
  topicStreak: number;
};

export function buildConversationState(
  turns: ConversationTurn[] = [],
  depthHint?: number,
): ConversationState {
  const lastUser = [...turns].reverse().find((t) => t.role === "user");
  const lastBuddy = [...turns].reverse().find((t) => t.role === "buddy");
  const depth = Math.max(1, depthHint ?? Math.min(12, turns.length + 1));
  return {
    depth,
    turns: turns.slice(-12),
    lastUserText: lastUser?.text ?? "",
    lastBuddyText: lastBuddy?.text ?? "",
    topicStreak: estimateTopicStreak(turns),
  };
}

function estimateTopicStreak(turns: ConversationTurn[]): number {
  let streak = 0;
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.role === "user") streak += 1;
    else break;
  }
  return streak;
}

export function isConversationalRepair(userText: string, lastBuddy: string): boolean {
  const t = userText.toLowerCase();
  if (/^(no|nope|not what i meant|i meant|actually|wait)/i.test(t)) return true;
  if (lastBuddy && /that'?s not|wrong|misunderstood/i.test(t)) return true;
  if (isMemoryForgetRequest(t)) return true;
  return false;
}

/** User asks to drop or correct a stored memory — never invent replacements. */
export function isMemoryForgetRequest(userText: string): boolean {
  const t = userText.toLowerCase();
  return (
    /forget (that|what i said|about that|it)/i.test(t) ||
    /delete (that )?memor/i.test(t) ||
    /i never said/i.test(t) ||
    /that'?s not true/i.test(t) ||
    /don'?t remember that/i.test(t)
  );
}

export function isRepeatQuestion(userText: string, turns: ConversationTurn[]): boolean {
  const norm = normalize(userText);
  if (norm.length < 4) return false;
  const prior = turns.filter((t) => t.role === "user").slice(-4, -1);
  return prior.some((t) => normalize(t.text) === norm);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function createConversationId(seed?: string): string {
  if (seed) return `c_${hash(seed).toString(36)}`;
  return `c_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function deriveEngagement(depth: number, intent: BuddyIntent, isRepair: boolean): EngagementState {
  if (isRepair || intent === "correction" || intent === "repair") return "repairing";
  if (intent === "farewell") return "closing";
  if (intent === "silence" || intent === "short_answer" || intent === "im_fine") return "quiet";
  if (depth <= 2) return "opening";
  if (depth <= 5) return "warming";
  return "deep";
}

export function computeContinuity(previousTopic: BuddyTopic | undefined, topic: BuddyTopic, previousIntent?: BuddyIntent, intent?: BuddyIntent): number {
  let c = 0.35;
  if (previousTopic && previousTopic === topic && topic !== "none") c += 0.4;
  if (previousIntent && intent && previousIntent === intent) c += 0.15;
  return Math.min(1, c);
}

export function computeNovelty(userText: string, recentUserTexts: string[]): number {
  const norm = normalize(userText);
  if (!norm) return 0.2;
  if (!recentUserTexts.length) return 0.9;
  const overlaps = recentUserTexts.map((r) => tokenOverlap(norm, normalize(r)));
  const maxOverlap = Math.max(...overlaps, 0);
  return Math.max(0.05, 1 - maxOverlap);
}

function tokenOverlap(a: string, b: string): number {
  const as = new Set(a.split(" ").filter((w) => w.length > 2));
  const bs = new Set(b.split(" ").filter((w) => w.length > 2));
  if (!as.size || !bs.size) return a === b ? 1 : 0;
  let inter = 0;
  for (const t of as) if (bs.has(t)) inter += 1;
  return inter / Math.max(as.size, bs.size);
}

export function advanceMachine(input: {
  previous?: ConversationMachineState;
  conversationId?: string;
  topic: BuddyTopic;
  subtopic: string | null;
  emotion: BuddyEmotion;
  intent: BuddyIntent;
  depth: number;
  userText: string;
  buddyText: string;
  familyId: string;
  memoryRefs: string[];
  isCorrection: boolean;
}): ConversationMachineState {
  const prev = input.previous;
  const conversationId = input.conversationId ?? prev?.conversationId ?? createConversationId(input.userText);
  const recentTopics = [...(prev?.recentTopics ?? []), input.topic].filter((t) => t !== "none").slice(-8);
  const recentResponseFamilies = [...(prev?.recentResponseFamilies ?? []), input.familyId].slice(-12);
  const userCorrections = (prev?.userCorrections ?? 0) + (input.isCorrection ? 1 : 0);
  const memoryReferences = [...new Set([...(prev?.memoryReferences ?? []), ...input.memoryRefs])].slice(-12);

  return {
    conversationId,
    topic: input.topic,
    subtopic: input.subtopic,
    emotionalTone: input.emotion,
    conversationDepth: input.depth,
    userIntent: input.intent,
    lastUserMessage: input.userText,
    lastBuddieResponse: input.buddyText,
    recentTopics,
    recentResponseFamilies,
    memoryReferences,
    userCorrections,
    engagementState: deriveEngagement(input.depth, input.intent, input.isCorrection),
  };
}

export function toInternalTurn(input: {
  topic: BuddyTopic;
  intent: BuddyIntent;
  emotion: BuddyEmotion;
  depth: number;
  continuity: number;
  novelty: number;
  confidence: number;
}): InternalTurnState {
  return { ...input };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
