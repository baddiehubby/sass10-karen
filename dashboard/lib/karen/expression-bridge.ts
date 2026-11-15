/**
 * Karen ↔ TalkingHead emotion bridge.
 * Maps Ollama mood tags ([ANGRY], [SARCASTIC], …) to ARKit blendshapes
 * and applies them on a live TalkingHead instance.
 */

export type KarenExpressionMood =
  | "SWEET"
  | "SARCASTIC"
  | "ANNOYED"
  | "ANGRY"
  | "FURIOUS"
  | "PROUD";

/** ARKit / TalkingHead morph targets we drive from chat moods. */
export type ArkitBlendshapes = {
  browDownLeft: number;
  browDownRight: number;
  browInnerUp: number;
  browOuterUpLeft: number;
  browOuterUpRight: number;
  eyeBlinkLeft: number;
  eyeBlinkRight: number;
  eyeSquintLeft: number;
  eyeSquintRight: number;
  eyeWideLeft: number;
  eyeWideRight: number;
  eyeLookUpLeft: number;
  eyeLookUpRight: number;
  noseSneerLeft: number;
  noseSneerRight: number;
  mouthSmileLeft: number;
  mouthSmileRight: number;
  mouthFrownLeft: number;
  mouthFrownRight: number;
  mouthDimpleLeft: number;
  jawOpen: number;
  mouthClose: number;
  /** TalkingHead pseudo-target — slight head tilt (radians-ish weight). */
  bodyRotateZ: number;
};

export type TalkingHeadMoodName =
  | "neutral"
  | "happy"
  | "angry"
  | "sad"
  | "fear"
  | "disgust"
  | "love"
  | "sleep";

/** Minimal TalkingHead surface used by the bridge (avoids importing the .mjs at build time). */
export type TalkingHeadLike = {
  setMood?: (mood: string) => void;
  setBaselineValue?: (mt: string, val: number | null) => void;
  setFixedValue?: (mt: string, val: number | null, ms?: number | null) => void;
  /** Reserved for the lip-sync / speakAudio pipeline (next prompt). */
  speakText?: (
    text: string,
    opt?: Record<string, unknown> | null,
  ) => void;
  speakAudio?: (
    audio: {
      audio?: AudioBuffer | ArrayBuffer | Int16Array | Int16Array[];
      words?: string[];
      wtimes?: number[];
      wdurations?: number[];
      [key: string]: unknown;
    },
    opt?: Record<string, unknown> | null,
  ) => void;
};

const ZERO: ArkitBlendshapes = {
  browDownLeft: 0,
  browDownRight: 0,
  browInnerUp: 0,
  browOuterUpLeft: 0,
  browOuterUpRight: 0,
  eyeBlinkLeft: 0,
  eyeBlinkRight: 0,
  eyeSquintLeft: 0,
  eyeSquintRight: 0,
  eyeWideLeft: 0,
  eyeWideRight: 0,
  eyeLookUpLeft: 0,
  eyeLookUpRight: 0,
  noseSneerLeft: 0,
  noseSneerRight: 0,
  mouthSmileLeft: 0,
  mouthSmileRight: 0,
  mouthFrownLeft: 0,
  mouthFrownRight: 0,
  mouthDimpleLeft: 0,
  jawOpen: 0,
  mouthClose: 0,
  bodyRotateZ: 0,
};

const MOODS: readonly KarenExpressionMood[] = [
  "SWEET",
  "SARCASTIC",
  "ANNOYED",
  "ANGRY",
  "FURIOUS",
  "PROUD",
];

const MOOD_TAG_RE =
  /\[(ANGRY|FURIOUS|SARCASTIC|PROUD|SWEET|ANNOYED)\]/i;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

function clampAll(shapes: ArkitBlendshapes): ArkitBlendshapes {
  const out = { ...ZERO };
  for (const key of Object.keys(ZERO) as Array<keyof ArkitBlendshapes>) {
    out[key] = clamp01(shapes[key] ?? 0);
  }
  return out;
}

export function normalizeMood(mood: unknown): KarenExpressionMood {
  if (typeof mood !== "string") return "SARCASTIC";
  const key = mood.trim().toUpperCase().replace(/^\[|\]$/g, "");
  if ((MOODS as readonly string[]).includes(key)) return key as KarenExpressionMood;
  return "SARCASTIC";
}

/**
 * Pull the first `[MOOD]` tag from an Ollama reply (or raw stream text).
 */
export function parseMoodTag(text: string | null | undefined): KarenExpressionMood | null {
  if (!text) return null;
  const m = text.match(MOOD_TAG_RE);
  if (!m?.[1]) return null;
  return normalizeMood(m[1]);
}

/** Strip mood tags so TTS / UI show clean copy. */
export function stripMoodTags(text: string): string {
  return text.replace(/\[(ANGRY|FURIOUS|SARCASTIC|PROUD|SWEET|ANNOYED)\]/gi, "").replace(/\s{2,}/g, " ").trim();
}

/** Map Karen chat moods → TalkingHead `setMood` names. */
export function mapChatMoodToTalkingHead(mood: unknown): TalkingHeadMoodName {
  switch (normalizeMood(mood)) {
    case "SWEET":
    case "PROUD":
      return "happy";
    case "SARCASTIC":
      return "disgust";
    case "ANGRY":
    case "FURIOUS":
      return "angry";
    case "ANNOYED":
    default:
      return "neutral";
  }
}

/**
 * Speaking jaw oscillation (injectable clock for tests).
 */
export function speakingJawOpen(nowMs: number = Date.now()): number {
  return clamp01(0.25 + 0.45 * Math.abs(Math.sin(nowMs / 120)));
}

function moodBase(mood: KarenExpressionMood): ArkitBlendshapes {
  const out = { ...ZERO };

  switch (mood) {
    case "SWEET":
      out.mouthSmileLeft = 0.55;
      out.mouthSmileRight = 0.55;
      out.browInnerUp = 0.08;
      break;

    case "SARCASTIC":
      // Asymmetric smirk + slight head tilt.
      out.mouthSmileLeft = 0.7;
      out.mouthSmileRight = 0.12;
      out.mouthDimpleLeft = 0.4;
      out.browOuterUpLeft = 0.65;
      out.browOuterUpRight = 0.05;
      out.bodyRotateZ = 0.12;
      break;

    case "ANNOYED":
      out.browDownLeft = 0.55;
      out.browDownRight = 0.55;
      out.eyeSquintLeft = 0.4;
      out.eyeSquintRight = 0.4;
      out.eyeLookUpLeft = 0.25;
      out.eyeLookUpRight = 0.25;
      out.mouthFrownLeft = 0.3;
      out.mouthFrownRight = 0.3;
      break;

    case "ANGRY":
    case "FURIOUS":
      // High-intensity scream face.
      out.browDownLeft = 1.0;
      out.browDownRight = 1.0;
      out.jawOpen = 0.85;
      out.eyeWideLeft = 0.9;
      out.eyeWideRight = 0.9;
      out.noseSneerLeft = 0.45;
      out.noseSneerRight = 0.45;
      out.mouthFrownLeft = 0.55;
      out.mouthFrownRight = 0.55;
      break;

    case "PROUD":
      // Relaxed brows + slight smile.
      out.browDownLeft = 0;
      out.browDownRight = 0;
      out.browInnerUp = 0.05;
      out.browOuterUpLeft = 0.12;
      out.browOuterUpRight = 0.12;
      out.mouthSmileLeft = 0.4;
      out.mouthSmileRight = 0.4;
      break;

    default:
      break;
  }

  return out;
}

/**
 * Map Karen mood + speaking flag → ARKit blendshape weights (0–1).
 */
export function getBlendshapes(
  mood: KarenExpressionMood | string,
  isSpeaking: boolean,
  nowMs?: number,
): ArkitBlendshapes {
  const safeMood = normalizeMood(mood);
  const out = moodBase(safeMood);

  if (isSpeaking) {
    const jaw = speakingJawOpen(nowMs ?? Date.now());
    // Angry scream keeps a high jaw floor while still pulsing.
    out.jawOpen =
      safeMood === "ANGRY" || safeMood === "FURIOUS"
        ? clamp01(Math.max(out.jawOpen, jaw))
        : jaw;
    out.mouthClose = clamp01((1 - out.jawOpen) * 0.12);
  } else if (safeMood !== "ANGRY" && safeMood !== "FURIOUS") {
    out.jawOpen = 0;
    out.mouthClose = 0;
  }

  if (safeMood === "ANGRY" || safeMood === "FURIOUS") {
    out.browDownLeft = 1.0;
    out.browDownRight = 1.0;
    out.eyeWideLeft = Math.max(out.eyeWideLeft, 0.9);
    out.eyeWideRight = Math.max(out.eyeWideRight, 0.9);
  }

  return clampAll(out);
}

/**
 * Apply mood to a live TalkingHead: `setMood` + ARKit baseline morphs.
 */
export function applyExpressionToTalkingHead(
  head: TalkingHeadLike | null | undefined,
  mood: KarenExpressionMood | string,
  opts: { isSpeaking?: boolean; nowMs?: number } = {},
): ArkitBlendshapes {
  const shapes = getBlendshapes(mood, Boolean(opts.isSpeaking), opts.nowMs);
  if (!head) return shapes;

  const thMood = mapChatMoodToTalkingHead(mood);
  try {
    head.setMood?.(thMood);
  } catch (err) {
    console.warn("[expression-bridge] setMood failed", thMood, err);
  }

  if (typeof head.setBaselineValue === "function") {
    for (const [name, value] of Object.entries(shapes)) {
      try {
        head.setBaselineValue(name, value);
      } catch {
        /* morph may be missing on this rig */
      }
    }
  }

  return shapes;
}

/**
 * Lip-sync entry — prefer `speakWithKaren` (API TTS → AudioBuffer → speakAudio).
 * Kept for callers that already hold a head reference; fire-and-forget.
 */
export function triggerKarenLipSync(
  head: TalkingHeadLike | null | undefined,
  text: string,
  opts: { mood?: KarenExpressionMood | string } = {},
): void {
  if (!text.trim()) return;
  // Dynamic import keeps this module free of "use client" for node tests.
  void import("@/lib/karen/voice")
    .then(({ speakWithKaren }) =>
      speakWithKaren(text, { head, mood: opts.mood, chunk: true }),
    )
    .catch((err) => console.warn("[triggerKarenLipSync]", err));
}

/** Convenience: expression + lip-sync hook in one call (chat loop). */
export function triggerKarenFaceFromReply(
  head: TalkingHeadLike | null | undefined,
  reply: string,
  moodHint?: string | null,
  opts: { isSpeaking?: boolean } = {},
): { mood: KarenExpressionMood; shapes: ArkitBlendshapes } {
  const mood = normalizeMood(moodHint || parseMoodTag(reply) || "SARCASTIC");
  const shapes = applyExpressionToTalkingHead(head, mood, {
    isSpeaking: opts.isSpeaking,
  });
  triggerKarenLipSync(head, reply, { mood });
  return { mood, shapes };
}
