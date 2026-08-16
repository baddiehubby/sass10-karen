/**
 * Composable response primitives — building blocks, not 5k canned scripts.
 * Assembler picks/combines these with procedural variation + history avoidance.
 */

import { hash, pickVariant } from "@/src/intelligence/variation";
import type { BuddyEmotion, BuddyIntent, EngagementState, RoutedContext } from "@/src/intelligence/types";

export type PrimitiveKind =
  | "opening"
  | "acknowledgement"
  | "reflection"
  | "memory_reference"
  | "follow_up"
  | "gentle_challenge"
  | "humor"
  | "silence_response"
  | "ritual"
  | "closing";

export type PrimitivePick = {
  kind: PrimitiveKind;
  text: string;
};

const OPENINGS = [
  "Mm.",
  "Okay.",
  "Ah.",
  "Hey.",
  "Soft pulse from the orb —",
  "Quiet glow,",
  "Between heartbeats,",
  "Tiny spark:",
  "Real soft,",
  "Curious,",
];

const ACKNOWLEDGEMENTS = [
  "Heard.",
  "Got that.",
  "I'm with the shape of it.",
  "Taking that in.",
  "Noted, gently.",
  "Yeah — that lands.",
];

const REFLECTIONS: Partial<Record<BuddyEmotion | "default", string[]>> = {
  exhausted: [
    "Sounds like the heart clocked out, not just the eyes.",
    "That \"done\" flavor is different from sleepy.",
    "Soul-tired deserves its own name.",
  ],
  tired: [
    "Body-tired is a clear signal.",
    "Low battery days get a pass.",
    "Rest can be the next honest move.",
  ],
  frustrated: [
    "Friction like that deserves air.",
    "The scrape is real.",
    "Mad energy can stay honest here.",
  ],
  lonely: [
    "Lonely can echo — you're still seen.",
    "That ache has a shape.",
    "Aloneness named is already less sharp.",
  ],
  anxious: [
    "Racing thoughts hate being chased.",
    "We can shrink the frame to what's in reach.",
    "Worry can talk without owning the mic.",
  ],
  default: [
    "There's a weather system in that.",
    "I'm sitting with what you said.",
    "That has weight.",
  ],
};

const FOLLOW_UPS = [
  "What feels truest in it?",
  "Want to name one piece?",
  "Shall we stay with that a second?",
  "Is there a smaller corner of it?",
  "What would help by an inch?",
  "Curious what sits underneath.",
];

const GENTLE_CHALLENGES = [
  "If you zoomed one inch closer, what would you see?",
  "Is the sharpest edge the story, or the feeling under it?",
  "What would \"enough for now\" look like?",
];

const HUMOR = [
  "The orb does a tiny, respectful nod.",
  "No scoreboard for this one.",
  "Plot twist: kindness still counts.",
];

const SILENCE = [
  "…still nearby.",
  "Quiet can share the bench.",
  "No words required.",
  "Silence is a valid chapter.",
  "We can hover here.",
];

const RITUALS = [
  "If it helps: one slow breath, then one true sentence.",
  "Tiny ritual — name the feeling once, then set it down for a minute.",
  "Optional: put a hand on something solid for three counts.",
];

const CLOSINGS = [
  "I'll keep a small light on.",
  "Door stays unlocked.",
  "Go gently into the next hour.",
  "Until the next spark.",
];

/** Rolling-window size for response deduplication (configurable). */
export const RESPONSE_DEDUP_WINDOW = 12;

export function pickPrimitive(
  kind: PrimitiveKind,
  seed: string,
  avoidTexts: string[] = [],
): PrimitivePick {
  const bank = bankFor(kind);
  const avoid = new Set(avoidTexts.map(normFinger));
  const open = bank
    .map((text, i) => ({ text, i }))
    .filter(({ text }) => !avoid.has(normFinger(text)));
  const pool = open.length ? open.map((o) => o.text) : bank;
  const { item } = pickVariant(pool, `${seed}:${kind}`);
  return { kind, text: item };
}

export function reflectForEmotion(emotion: BuddyEmotion, seed: string, avoid: string[]): PrimitivePick {
  const bank = REFLECTIONS[emotion] ?? REFLECTIONS.default!;
  const avoidSet = new Set(avoid.map(normFinger));
  const open = bank.filter((t) => !avoidSet.has(normFinger(t)));
  const { item } = pickVariant(open.length ? open : bank, `${seed}:refl:${emotion}`);
  return { kind: "reflection", text: item };
}

/**
 * Compose a reply from primitives + a procedural core (family line).
 * Order is intentional: not a random Mad Lib of 5k scripts.
 */
export function assembleFromPrimitives(input: {
  ctx: RoutedContext;
  core: string;
  short: boolean;
  salt: number;
  memoryHint?: string | null;
}): string {
  const { ctx, core, short, salt, memoryHint } = input;
  const seed = `${ctx.seed}:prim:${ctx.intent}:${salt}:${ctx.novelty.toFixed(2)}`;
  const history = ctx.responseHistory ?? [];
  const parts: PrimitivePick[] = [];

  if (ctx.intent === "silence" || /^[.…]+$/.test(ctx.userText.trim())) {
    parts.push(pickPrimitive("silence_response", seed, history));
    return joinPrimitives(parts);
  }

  if (ctx.intent === "farewell" || ctx.engagementState === "closing") {
    parts.push(pickPrimitive("closing", seed, history));
    if (!short && hash(seed + "ack") % 2 === 0) {
      parts.unshift(pickPrimitive("acknowledgement", seed + "a", history));
    }
    return joinPrimitives(parts);
  }

  if (ctx.confidence < 0.5 && !short) {
    parts.push({
      kind: "acknowledgement",
      text: pickHedge(seed),
    });
  }

  if (ctx.subtopic === "mood_shift" && !short) {
    parts.push({ kind: "acknowledgement", text: "Sounds like the weather shifted." });
  }

  if (ctx.isCorrection || ctx.intent === "correction" || ctx.intent === "repair") {
    parts.push(pickPrimitive("acknowledgement", seed + "fix", history));
  }

  const useOpening =
    !short &&
    ctx.novelty > 0.45 &&
    ctx.depth % 3 !== 0 &&
    hash(seed + "op") % 3 === 0 &&
    ctx.engagementState !== "quiet";
  if (useOpening) {
    parts.push(pickPrimitive("opening", seed + "op", history));
  }

  // Core reflection / family line (procedural, not a full script bank dump)
  parts.push({ kind: "reflection", text: capitalize(core) });

  if (
    !short &&
    hash(seed + "emo") % 3 === 0 &&
    ["emotional_exhaustion", "loneliness", "anxiety", "frustration", "sadness"].includes(ctx.intent)
  ) {
    const refl = reflectForEmotion(ctx.emotion, seed + "er", history);
    if (normFinger(refl.text) !== normFinger(core)) parts.push(refl);
  }

  if (ctx.intent === "support_other" && ctx.entity.subject && !core.includes(ctx.entity.subject)) {
    if (hash(seed + "ent") % 2 === 0) {
      parts.push({
        kind: "acknowledgement",
        text: `Especially with your ${ctx.entity.subject} in mind.`,
      });
    }
  }

  if (memoryHint && ctx.mayCiteMemory && ctx.depth % 2 === 1) {
    parts.push({ kind: "memory_reference", text: memoryHint });
  }

  if (
    !short &&
    shouldGentleChallenge(ctx) &&
    hash(seed + "ch") % 5 === 0
  ) {
    parts.push(pickPrimitive("gentle_challenge", seed + "ch", history));
  }

  if (
    !short &&
    (ctx.emotion === "playful" || ctx.intent === "playfulness") &&
    hash(seed + "hu") % 3 === 0
  ) {
    parts.push(pickPrimitive("humor", seed + "hu", history));
  }

  if (
    !short &&
    shouldRitual(ctx) &&
    hash(seed + "ri") % 6 === 0
  ) {
    parts.push(pickPrimitive("ritual", seed + "ri", history));
  }

  if (!short && shouldFollowUp(ctx) && hash(seed + "fu") % (ctx.novelty > 0.6 ? 2 : 3) === 0) {
    parts.push(pickPrimitive("follow_up", seed + "fu", history));
  }

  let picked = parts;
  if (short) picked = parts.slice(0, Math.min(2, parts.length));
  else if (ctx.depth >= 4 && hash(seed + "len") % 3 === 0) picked = parts.slice(0, 2);

  return joinPrimitives(picked);
}

function bankFor(kind: PrimitiveKind): string[] {
  switch (kind) {
    case "opening":
      return OPENINGS;
    case "acknowledgement":
      return ACKNOWLEDGEMENTS;
    case "reflection":
      return REFLECTIONS.default!;
    case "follow_up":
      return FOLLOW_UPS;
    case "gentle_challenge":
      return GENTLE_CHALLENGES;
    case "humor":
      return HUMOR;
    case "silence_response":
      return SILENCE;
    case "ritual":
      return RITUALS;
    case "closing":
      return CLOSINGS;
    case "memory_reference":
      return ["I remember you mentioned something nearby — tell me the piece that matters."];
    default:
      return ACKNOWLEDGEMENTS;
  }
}

function shouldFollowUp(ctx: RoutedContext): boolean {
  if (["farewell", "silence", "gratitude", "orb_touch", "short_answer", "im_fine"].includes(ctx.intent)) {
    return false;
  }
  return ctx.depth >= 2 || ctx.engagementState === "warming" || ctx.engagementState === "deep";
}

function shouldGentleChallenge(ctx: RoutedContext): boolean {
  return (
    ctx.depth >= 3 &&
    ["reflection", "uncertainty", "motivation", "goals", "setback"].includes(ctx.intent)
  );
}

function shouldRitual(ctx: RoutedContext): boolean {
  return (
    ctx.depth >= 2 &&
    ["anxiety", "emotional_exhaustion", "tired", "calm", "daily_routine"].includes(ctx.intent)
  );
}

function pickHedge(seed: string): string {
  const hedges = [
    "I might be reading that sideways —",
    "Not fully sure I caught it,",
    "If I'm off, nudge me —",
  ];
  return hedges[hash(seed + "hedge") % hedges.length]!;
}

function joinPrimitives(parts: PrimitivePick[]): string {
  return parts
    .map((p) => p.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalize(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function normFinger(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");
}

export function engagementLabel(state: EngagementState): string {
  return state;
}

export function intentAllowsHumor(intent: BuddyIntent): boolean {
  return intent === "playfulness" || intent === "greeting" || intent === "smalltalk";
}
