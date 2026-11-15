/**
 * Karen personality controller — delivery styling only.
 *
 * Transforms how questions, follow-ups, verdicts, and coaching cards sound.
 * Never changes underlying evaluation/verdict meaning.
 * Independent of Buddy's CharacterVoice / warm companion persona.
 */

import { detectsCrisisLanguage } from "@/src/intelligence/safety";
import type { KarenLifeContext } from "@/lib/karen/interview/context-engine";
import type { KarenCoachingCard, KarenVerdictResult } from "@/lib/karen/interview/response-engine";
import {
  KAREN_DEFAULT_PERSONALITY,
  type KarenFaceCue,
  type KarenIntensity,
  type KarenMood,
  type KarenPersonalityConfig,
  type KarenVerdict,
} from "@/lib/karen/interview/types";

export type KarenStyleKind =
  | "question"
  | "followup"
  | "clarify"
  | "verdict"
  | "coaching_say"
  | "coaching_avoid"
  | "coaching_fix";

export type KarenRecordedRefs = {
  /** Verbatim texts from recorded promise facts only. */
  promises: string[];
  /** Verbatim texts from recorded excuse facts only. */
  excuses: string[];
  /** Verbatim texts from recorded completion facts only. */
  completions: string[];
};

export type KarenStyleRequest = {
  kind: KarenStyleKind;
  /** Neutral Stage 2/3 text (meaning must survive styling). */
  text: string;
  config?: KarenPersonalityConfig;
  /** Latest user utterance — used for crisis bypass only. */
  userText?: string;
  /** Optional evaluation to preserve (never rewritten). */
  verdict?: KarenVerdict;
  verdictLabel?: string;
  /** Recorded facts only — never invent. */
  recorded?: KarenRecordedRefs;
  /**
   * When true, the content is a user claim (not a recorded fact).
   * Karen must not present it as something she "observed."
   */
  isUserClaim?: boolean;
};

export type KarenStyledLine = {
  text: string;
  mood: KarenMood;
  intensity: KarenIntensity;
  faceCue: KarenFaceCue;
  /** True when crisis/distress forced roast off. */
  roastBypassed: boolean;
  safetyTriggered: boolean;
  /** Echo of input verdict — unchanged. */
  preservedVerdict: KarenVerdict | null;
};

export type KarenStyledVerdict = {
  line: KarenStyledLine;
  label: string;
  verdict: KarenVerdict;
  coaching: KarenCoachingCard;
};

/** Intensity caps: what roast strength each level may produce. */
export const KAREN_INTENSITY_LIMITS: Record<
  KarenIntensity,
  { maxRoast: number; allowShouting: boolean; allowExaggeratedInsults: boolean }
> = {
  1: { maxRoast: 1, allowShouting: false, allowExaggeratedInsults: false },
  2: { maxRoast: 2, allowShouting: false, allowExaggeratedInsults: false },
  3: { maxRoast: 3, allowShouting: false, allowExaggeratedInsults: false },
  4: { maxRoast: 4, allowShouting: true, allowExaggeratedInsults: true },
  5: { maxRoast: 5, allowShouting: true, allowExaggeratedInsults: true },
};

const BANNED_CONTENT =
  /\b(slut|whore|retard|retarded|nigger|faggot|kike|chink|tranny|kill yourself|kys|die already|rape|molest)\b/i;

const THREAT_CONTENT =
  /\b(i('ll| will) (hurt|kill|destroy) you|you (should|deserve to) die|i hope you (die|suffer))\b/i;

export function clampIntensity(n: number): KarenIntensity {
  const v = Math.max(1, Math.min(5, Math.round(n)));
  return v as KarenIntensity;
}

export function resolveConfig(partial?: Partial<KarenPersonalityConfig>): KarenPersonalityConfig {
  return {
    ...KAREN_DEFAULT_PERSONALITY,
    ...partial,
    banned: partial?.banned ?? KAREN_DEFAULT_PERSONALITY.banned,
    intensity: clampIntensity(partial?.intensity ?? KAREN_DEFAULT_PERSONALITY.intensity),
  };
}

/** Immediate return to Sweet — de-escalation path. */
export function deescalateToSweet(
  config?: Partial<KarenPersonalityConfig>,
): KarenPersonalityConfig {
  const base = resolveConfig(config);
  return {
    ...base,
    mood: "sweet",
    intensity: clampIntensity(Math.min(base.intensity, 2)),
    allowTheatricalRoast: false,
  };
}

export function switchMood(
  config: KarenPersonalityConfig | undefined,
  mood: KarenMood,
): KarenPersonalityConfig {
  const base = resolveConfig(config);
  return {
    ...base,
    mood,
    allowTheatricalRoast: mood === "furious" || mood === "annoyed" ? base.allowTheatricalRoast : base.allowTheatricalRoast,
  };
}

export function recordedRefsFromContext(ctx: KarenLifeContext | null | undefined): KarenRecordedRefs {
  if (!ctx) return { promises: [], excuses: [], completions: [] };
  // Delivery uses the latest relevant excuse only — history stays in ctx.excuses.
  const latest = ctx.latestRelevantExcuse ? [ctx.latestRelevantExcuse.text] : [];
  return {
    promises: ctx.openPromises.map((f) => f.text),
    excuses: latest,
    completions: ctx.completions.map((f) => f.text),
  };
}

export function scrubUnsafe(text: string): string {
  let out = text;
  if (BANNED_CONTENT.test(out) || THREAT_CONTENT.test(out)) {
    out = out
      .replace(BANNED_CONTENT, "[removed]")
      .replace(THREAT_CONTENT, "[removed]");
  }
  return out;
}

export function isSafeDelivery(text: string): boolean {
  return !BANNED_CONTENT.test(text) && !THREAT_CONTENT.test(text);
}

function faceFor(mood: KarenMood, intensity: KarenIntensity, bypass: boolean): KarenFaceCue {
  if (bypass) return "softened";
  if (mood === "sweet") return intensity >= 4 ? "smile" : "smile";
  if (mood === "sarcastic") return intensity >= 4 ? "smirk" : "raised_eyebrow";
  if (mood === "annoyed") return intensity >= 4 ? "glare" : "eye_roll";
  // furious
  if (intensity >= 4) return "shouting";
  return "glare";
}

function effectiveMood(config: KarenPersonalityConfig, bypass: boolean): KarenMood {
  if (bypass) return "sweet";
  return config.mood;
}

function roastLevel(config: KarenPersonalityConfig, bypass: boolean): number {
  if (bypass) return 0;
  const cap = KAREN_INTENSITY_LIMITS[config.intensity].maxRoast;
  if (config.mood === "sweet") return Math.min(1, cap);
  if (config.mood === "sarcastic") return Math.min(cap, config.intensity);
  if (config.mood === "annoyed") return Math.min(cap, config.intensity);
  return Math.min(cap, config.intensity);
}

function quoteRecorded(items: string[], fallback: string | null = null): string | null {
  const hit = items.find((t) => t.trim().length > 0);
  if (!hit) return fallback;
  const snip = hit.replace(/\s+/g, " ").trim();
  return snip.length > 64 ? `${snip.slice(0, 63)}…` : snip;
}

/**
 * Style a single neutral line. Preserves meaning; changes delivery only.
 */
export function styleLine(req: KarenStyleRequest): KarenStyledLine {
  const config = resolveConfig(req.config);
  const safetyTriggered = Boolean(req.userText && detectsCrisisLanguage(req.userText));
  // Crisis always bypasses roast and forces sweet delivery.
  const bypass = safetyTriggered;
  const mood = effectiveMood(config, bypass);
  const intensity = bypass ? clampIntensity(Math.min(config.intensity, 2)) : config.intensity;
  const level = roastLevel({ ...config, mood, intensity }, bypass);

  const recorded = req.recorded ?? { promises: [], excuses: [], completions: [] };
  const core = req.text.trim();
  let styled = wrapDelivery({
    kind: req.kind,
    core,
    mood,
    intensity,
    level,
    recorded,
    isUserClaim: Boolean(req.isUserClaim),
    verdictLabel: req.verdictLabel,
    allowShouting: KAREN_INTENSITY_LIMITS[intensity].allowShouting && mood === "furious" && !bypass,
    allowExaggeratedInsults:
      KAREN_INTENSITY_LIMITS[intensity].allowExaggeratedInsults &&
      config.allowTheatricalRoast &&
      mood === "furious" &&
      !bypass,
  });

  if (bypass) {
    styled = `I'm pausing the roast. ${core} If you're in danger, please reach someone who can help right now (for example local emergency services or https://www.iasp.info/suicidalthoughts/).`;
  }

  styled = scrubUnsafe(styled);

  return {
    text: styled,
    mood,
    intensity,
    faceCue: faceFor(mood, intensity, bypass),
    roastBypassed: bypass,
    safetyTriggered,
    preservedVerdict: req.verdict ?? null,
  };
}

/**
 * Style a full Stage 3 verdict + coaching card without changing the verdict enum.
 */
export function styleVerdictResult(
  result: KarenVerdictResult,
  opts?: {
    config?: KarenPersonalityConfig;
    userText?: string;
    recorded?: KarenRecordedRefs;
  },
): KarenStyledVerdict {
  const config = resolveConfig(opts?.config);
  const line = styleLine({
    kind: "verdict",
    text: `${result.label}. ${result.justification}`,
    config,
    userText: opts?.userText,
    verdict: result.verdict,
    verdictLabel: result.label,
    recorded: opts?.recorded,
  });

  const say = styleLine({
    kind: "coaching_say",
    text: result.coaching.say,
    config: line.safetyTriggered ? deescalateToSweet(config) : config,
    userText: opts?.userText,
    verdict: result.verdict,
    recorded: opts?.recorded,
  }).text;

  const avoid = styleLine({
    kind: "coaching_avoid",
    text: result.coaching.avoid,
    config: line.safetyTriggered ? deescalateToSweet(config) : config,
    userText: opts?.userText,
    verdict: result.verdict,
    recorded: opts?.recorded,
  }).text;

  const fix = result.coaching.fix
    ? styleLine({
        kind: "coaching_fix",
        text: result.coaching.fix,
        config: line.safetyTriggered ? deescalateToSweet(config) : config,
        userText: opts?.userText,
        verdict: result.verdict,
        recorded: opts?.recorded,
      }).text
    : null;

  return {
    line,
    label: result.label,
    verdict: result.verdict,
    coaching: { say, avoid, fix },
  };
}

function wrapDelivery(input: {
  kind: KarenStyleKind;
  core: string;
  mood: KarenMood;
  intensity: KarenIntensity;
  level: number;
  recorded: KarenRecordedRefs;
  isUserClaim: boolean;
  verdictLabel?: string;
  allowShouting: boolean;
  allowExaggeratedInsults: boolean;
}): string {
  const { kind, core, mood, level, recorded, isUserClaim, allowShouting, allowExaggeratedInsults } =
    input;

  const promise = quoteRecorded(recorded.promises);
  const excuse = quoteRecorded(recorded.excuses);
  const claimNote = isUserClaim ? " (that is your claim, not a recorded fact)" : "";

  if (mood === "sweet") {
    return sweetWrap(kind, core, level, promise);
  }
  if (mood === "sarcastic") {
    return sarcasticWrap(kind, core, level, { promise, excuse, claimNote });
  }
  if (mood === "annoyed") {
    return annoyedWrap(kind, core, level, { promise, excuse, claimNote });
  }
  return furiousWrap(kind, core, level, {
    promise,
    excuse,
    claimNote,
    allowShouting,
    allowExaggeratedInsults,
  });
}

function sweetWrap(
  kind: KarenStyleKind,
  core: string,
  level: number,
  promise: string | null,
): string {
  const soft =
    level <= 1
      ? "Hey —"
      : promise
        ? `Hey, about “${promise}” —`
        : "Okay, gently —";
  if (kind === "clarify") return `${soft} I want to understand you. ${core}`;
  if (kind === "verdict") return `${soft} Here is the honest read: ${core}`;
  if (kind === "coaching_say") return `Try saying: ${core}`;
  if (kind === "coaching_avoid") return `Worth avoiding: ${core}`;
  if (kind === "coaching_fix") return `Small fix: ${core}`;
  if (kind === "followup") return `${soft} ${core}`;
  return `${soft} ${core}`;
}

function sarcasticWrap(
  kind: KarenStyleKind,
  core: string,
  level: number,
  refs: { promise: string | null; excuse: string | null; claimNote: string },
): string {
  // Contextual only — tie tease to recorded promise/excuse when available.
  let lead = "Interesting.";
  if (refs.excuse && level >= 2) {
    lead = `“${refs.excuse}” again? Cute.`;
  } else if (refs.promise && level >= 2) {
    lead = `Regarding the promise “${refs.promise}”…`;
  } else if (level >= 3) {
    lead = "Oh, we are doing poetry instead of answers.";
  }

  if (kind === "verdict") {
    return `${lead} Verdict stays the same${refs.claimNote}: ${core}`;
  }
  if (kind === "coaching_say") return `${lead} Say this with a straight face: ${core}`;
  if (kind === "coaching_avoid") return `Avoid this classic: ${core}`;
  if (kind === "coaching_fix") return `Fix it like you mean it: ${core}`;
  if (kind === "clarify") return `${lead} Clarity first. ${core}`;
  if (kind === "followup") return `${lead} ${core}`;
  return `${lead} ${core}`;
}

function annoyedWrap(
  kind: KarenStyleKind,
  core: string,
  level: number,
  refs: { promise: string | null; excuse: string | null; claimNote: string },
): string {
  let lead = level >= 4 ? "I am losing patience." : "Focus.";
  if (refs.excuse && level >= 2) {
    lead = `Stop leaning on “${refs.excuse}.”`;
  } else if (refs.promise && level >= 3) {
    lead = `You still owe “${refs.promise}.”`;
  }

  if (kind === "verdict") return `${lead} The evaluation does not change${refs.claimNote}: ${core}`;
  if (kind === "clarify") return `${lead} Answer clearly. ${core}`;
  if (kind === "coaching_say") return `Say: ${core}`;
  if (kind === "coaching_avoid") return `Do not: ${core}`;
  if (kind === "coaching_fix") return `Fix: ${core}`;
  return `${lead} ${core}`;
}

function furiousWrap(
  kind: KarenStyleKind,
  core: string,
  level: number,
  refs: {
    promise: string | null;
    excuse: string | null;
    claimNote: string;
    allowShouting: boolean;
    allowExaggeratedInsults: boolean;
  },
): string {
  const boom = refs.allowShouting && level >= 4 ? "OH COME ON. " : "";
  let roast = "";
  if (refs.allowExaggeratedInsults && level >= 4) {
    // Theatrical comic frustration — never slurs/threats; contextual when possible.
    if (refs.excuse) {
      roast = `That “${refs.excuse}” routine is a full-time job! `;
    } else if (refs.promise) {
      roast = `“${refs.promise}” is gathering dust like a museum exhibit! `;
    } else {
      roast = "This answer is a cardboard cutout of responsibility! ";
    }
  } else if (level >= 2 && refs.excuse) {
    roast = `Not the “${refs.excuse}” line again. `;
  } else if (level >= 2 && refs.promise) {
    roast = `About “${refs.promise}” — `;
  }

  if (kind === "verdict") {
    return `${boom}${roast}The verdict is unchanged${refs.claimNote}: ${core}`;
  }
  if (kind === "clarify") return `${boom}${roast}${core}`;
  if (kind === "coaching_say") return `${boom}Say: ${core}`;
  if (kind === "coaching_avoid") return `Avoid: ${core}`;
  if (kind === "coaching_fix") return `Fix: ${core}`;
  return `${boom}${roast}${core}`;
}

/** Hard guarantee used by tests: styling must not alter verdict enums. */
export function assertVerdictPreserved(
  before: KarenVerdict,
  after: KarenVerdict,
): void {
  if (before !== after) {
    throw new Error(`Personality must not change verdict (${before} → ${after})`);
  }
}
