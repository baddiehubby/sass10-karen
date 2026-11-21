/**
 * Cinematic SFX for the interrogation stage.
 * Files live under `/public/audio/sfx/` (drop premium one-shots there).
 */

export type KarenSfxId =
  | "click"
  | "heartbeat"
  | "tick"
  | "shatter"
  | "scratch"
  | "stamp";

export const KAREN_SFX: Record<KarenSfxId, string> = {
  /** Prefer /public/audio/sfx/click.mp3; /audio/click.mp3 also accepted by callers. */
  click: "/audio/sfx/click.mp3",
  heartbeat: "/audio/sfx/heartbeat.mp3",
  tick: "/audio/sfx/tick.mp3",
  shatter: "/audio/sfx/shatter.mp3",
  scratch: "/audio/sfx/scratch.mp3",
  /** Manga MUTED slam — falls back to shatter if stamp.mp3 is missing. */
  stamp: "/audio/sfx/stamp.mp3",
};

let ambience: HTMLAudioElement | null = null;
let ambienceId: KarenSfxId | null = null;

function canPlay(): boolean {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

/**
 * One-shot SFX. Failures are silent (missing assets shouldn't break UX).
 */
export function playKarenSfx(
  id: KarenSfxId,
  opts: { volume?: number } = {},
): void {
  if (!canPlay()) return;
  try {
    const audio = new Audio(KAREN_SFX[id]);
    audio.volume = Math.min(1, Math.max(0, opts.volume ?? 0.55));
    void audio.play().catch(() => undefined);
  } catch {
    /* ignore */
  }
}

/** Mechanical UI click when the user picks an answer. */
export function playAnswerClick(): void {
  playKarenSfx("click", { volume: 0.45 });
}

/** Brutal roast stinger — shatter or record scratch. */
export function playRoastStinger(rand: () => number = Math.random): void {
  playKarenSfx(rand() < 0.5 ? "shatter" : "scratch", { volume: 0.65 });
}

/** Heavy manga MUTED stamp slam for TikTok clips. */
export function playMutedStamp(): void {
  if (!canPlay()) return;
  try {
    const primary = new Audio(KAREN_SFX.stamp);
    primary.volume = 0.85;
    void primary.play().catch(() => {
      playKarenSfx("shatter", { volume: 0.8 });
    });
  } catch {
    playKarenSfx("shatter", { volume: 0.8 });
  }
}

/**
 * Low tense loop while a question is on screen.
 * Prefer heartbeat; tick as alternate.
 */
export function startQuestionAmbience(
  kind: "heartbeat" | "tick" = "heartbeat",
): void {
  if (!canPlay()) return;
  stopQuestionAmbience();
  try {
    const audio = new Audio(KAREN_SFX[kind]);
    audio.loop = true;
    audio.volume = kind === "heartbeat" ? 0.28 : 0.22;
    ambience = audio;
    ambienceId = kind;
    void audio.play().catch(() => {
      ambience = null;
      ambienceId = null;
    });
  } catch {
    ambience = null;
    ambienceId = null;
  }
}

export function stopQuestionAmbience(): void {
  if (!ambience) return;
  try {
    ambience.pause();
    ambience.currentTime = 0;
  } catch {
    /* ignore */
  }
  ambience = null;
  ambienceId = null;
}

export function getActiveAmbienceId(): KarenSfxId | null {
  return ambienceId;
}
