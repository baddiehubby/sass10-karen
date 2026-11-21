/**
 * Impatience interrupt — Karen cuts in after ~3s of silence while the user
 * hesitates mid-type / mid-scream. Mood: ANNOYED.
 * Pool: `categories.interrupts` with no-repeat routing.
 */

import { pickCategoryClip } from "@/lib/karen/audio-router";
import { resolveSmackbackSrc } from "@/lib/karen/smack-back";
import type { TalkingHeadLike } from "@/lib/karen/expression-bridge";

export const IMPATIENCE_SILENCE_MS = 3_000;

export type ImpatienceClip = {
  id: string;
  text: string;
  src: string;
  mood: "ANNOYED";
};

const FALLBACK_LINES: Array<{ id: string; text: string; file: string }> = [
  {
    id: "impatience_all_day",
    text: "I don't have all day!",
    file: "smackbacks/sb_11.wav",
  },
  {
    id: "impatience_spit",
    text: "Spit it out!",
    file: "smackbacks/sb_17.wav",
  },
  {
    id: "impatience_coward",
    text: "Coward.",
    file: "smackbacks/dominance_01.wav",
  },
];

/** Pick a random impatience interrupt clip (fresh from interrupts category). */
export function pickImpatienceInterrupt(
  rng: () => number = Math.random,
): ImpatienceClip {
  const fromCat = pickCategoryClip("interrupts", { rng });
  if (fromCat) {
    return {
      id: `interrupt:${fromCat.id || "impatience"}`,
      text: fromCat.text || "Spit it out!",
      src: resolveSmackbackSrc(fromCat.file),
      mood: "ANNOYED",
    };
  }
  const line = FALLBACK_LINES[Math.floor(rng() * FALLBACK_LINES.length)]!;
  return {
    id: `interrupt:${line.id}`,
    text: line.text,
    src: resolveSmackbackSrc(line.file),
    mood: "ANNOYED",
  };
}

/**
 * Decode → TalkingHead.speakAudio (same lip-sync path as combat).
 * Sets ANNOYED mood on the avatar expression bus via caller.
 */
export async function playImpatienceInterrupt(
  head?: TalkingHeadLike | null,
  clip: ImpatienceClip = pickImpatienceInterrupt(),
): Promise<ImpatienceClip> {
  const { playWavWithLipsync, unlockKarenAudio, getRegisteredKarenTalkingHead } =
    await import("@/lib/karen/voice");
  const target = head ?? getRegisteredKarenTalkingHead();
  await unlockKarenAudio(target);
  try {
    await playWavWithLipsync(clip.src, target, {
      text: clip.text,
      volume: 1,
    });
  } catch (err) {
    console.warn("[impatience] wav failed — TTS fallback", clip.src, err);
    const { speakWithKaren } = await import("@/lib/karen/voice");
    await speakWithKaren(clip.text, { head: target, mood: "ANNOYED" });
  }
  return clip;
}
