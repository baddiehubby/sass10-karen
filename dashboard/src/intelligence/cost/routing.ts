/**
 * Cost routing — premium local first; never escalate avoidable work to expensive intelligence.
 * Internal only — never surface provider/tier names to users.
 */

import type { BuddyIntent } from "@/src/intelligence/types";

/** Ordered resolution priority (lowest cost / highest preference first). */
export type CostRouteTier =
  | "soul_engine"
  | "local_lightweight"
  | "user_authorized"
  | "fallback_required";

export const COST_ROUTE_PRIORITY: readonly CostRouteTier[] = [
  "soul_engine",
  "local_lightweight",
  "user_authorized",
  "fallback_required",
] as const;

/**
 * Intents that must NEVER call expensive / remote intelligence.
 * Soul Engine + local lightweight are always sufficient.
 */
export const NEVER_EXPENSIVE_INTENTS: ReadonlySet<BuddyIntent> = new Set([
  "greeting",
  "farewell",
  "returning",
  "emotional_checkin",
  "silence",
  "short_answer",
  "orb_touch",
  "im_fine",
  "gratitude",
  "daily_routine",
  "encouragement",
  "calm",
  "playfulness",
  "smalltalk",
  "repeat",
  "memory_reference",
  "correction",
  "repair",
]);

/** Static / product surfaces — never need model spend. */
const STATIC_PRODUCT_PATTERNS = [
  /\b(pricing|subscription|billing|starter plan|premium plan|pro plan)\b/i,
  /\b(settings|preferences|account|logout|sign out|privacy policy)\b/i,
  /\b(how (do|does) (buddie|buddy) work|what is buddie|install extension)\b/i,
  /\b(open (the )?dashboard|memories page|oracle page)\b/i,
];

export type CostRouteDecision = {
  tier: CostRouteTier;
  neverExpensive: boolean;
  reason: string;
  /** Whether a deterministic user-scoped cache may be used. */
  cacheSafe: boolean;
  /** External / authorized path may be considered (still gated further). */
  mayEscalate: boolean;
};

export function isNeverExpensiveIntent(intent: BuddyIntent): boolean {
  return NEVER_EXPENSIVE_INTENTS.has(intent);
}

export function looksLikeStaticProductRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return STATIC_PRODUCT_PATTERNS.some((re) => re.test(t));
}

/**
 * Basic emotional support that Soul Engine already covers well —
 * do not escalate solely because the message is emotional.
 */
export function isBasicEmotionalSupport(intent: BuddyIntent): boolean {
  return (
    intent === "loneliness" ||
    intent === "sadness" ||
    intent === "anxiety" ||
    intent === "frustration" ||
    intent === "tired" ||
    intent === "emotional_exhaustion" ||
    intent === "uncertainty" ||
    intent === "encouragement" ||
    intent === "calm"
  );
}

export function selectCostRoute(input: {
  intent: BuddyIntent;
  userText: string;
  conversationDepth: number;
  isRepeat?: boolean;
  mayCiteMemory?: boolean;
  /** User explicitly enabled authorized remote intelligence (env/config). */
  userAuthorizedEnabled?: boolean;
  /** Only true when a genuine capability gap remains after local composition. */
  genuineExternalNeed?: boolean;
}): CostRouteDecision {
  const neverExpensive =
    isNeverExpensiveIntent(input.intent) ||
    looksLikeStaticProductRequest(input.userText) ||
    input.isRepeat === true ||
    (input.intent === "memory_reference" && !input.mayCiteMemory);

  const cacheSafe =
    neverExpensive &&
    !input.mayCiteMemory &&
    input.conversationDepth <= 3 &&
    ["greeting", "farewell", "orb_touch", "silence", "short_answer", "returning", "im_fine"].includes(
      input.intent,
    );

  if (neverExpensive || isBasicEmotionalSupport(input.intent)) {
    return {
      tier: "soul_engine",
      neverExpensive: true,
      reason: "local_soul_sufficient",
      cacheSafe,
      mayEscalate: false,
    };
  }

  // Lightweight local path (tiny enricher / adaptive) — still $0
  if (!input.genuineExternalNeed) {
    return {
      tier: "local_lightweight",
      neverExpensive: true,
      reason: "local_composition",
      cacheSafe: false,
      mayEscalate: false,
    };
  }

  if (input.userAuthorizedEnabled) {
    return {
      tier: "user_authorized",
      neverExpensive: false,
      reason: "user_authorized_escalation",
      cacheSafe: false,
      mayEscalate: true,
    };
  }

  // Policy: do not silently bill for fallback. Prefer excellent local reply.
  return {
    tier: "soul_engine",
    neverExpensive: true,
    reason: "fallback_suppressed_local_preferred",
    cacheSafe: false,
    mayEscalate: false,
  };
}

/** Env gate — remote authorized path off by default. */
export function isUserAuthorizedIntelligenceEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {},
): boolean {
  const v = (env.BUDDIE_USER_AUTHORIZED_INTELLIGENCE ?? env.NEXT_PUBLIC_BUDDIE_USER_AUTHORIZED_INTELLIGENCE ?? "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}
