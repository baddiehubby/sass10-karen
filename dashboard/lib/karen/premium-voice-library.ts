/**
 * Mood-bucket premium clips under `/public/audio/roasts/`.
 * Soft fallback when the mapped audio-bank clip is missing.
 * Prefer `lib/karen/audio-bank.ts` for exact Q/A/roast lines.
 */

export type PremiumVoiceMood = "angry" | "proud" | "sarcastic";

/** 20 assumed premium voice clips (10 angry / 5 proud / 5 sarcastic). */
export const PREMIUM_ROAST_FILES: Record<PremiumVoiceMood, readonly string[]> = {
  angry: [
    "/audio/roasts/angry_01.mp3",
    "/audio/roasts/angry_02.mp3",
    "/audio/roasts/angry_03.mp3",
    "/audio/roasts/angry_04.mp3",
    "/audio/roasts/angry_05.mp3",
    "/audio/roasts/angry_06.mp3",
    "/audio/roasts/angry_07.mp3",
    "/audio/roasts/angry_08.mp3",
    "/audio/roasts/angry_09.mp3",
    "/audio/roasts/angry_10.mp3",
  ],
  proud: [
    "/audio/roasts/proud_01.mp3",
    "/audio/roasts/proud_02.mp3",
    "/audio/roasts/proud_03.mp3",
    "/audio/roasts/proud_04.mp3",
    "/audio/roasts/proud_05.mp3",
  ],
  sarcastic: [
    "/audio/roasts/sarcastic_01.mp3",
    "/audio/roasts/sarcastic_02.mp3",
    "/audio/roasts/sarcastic_03.mp3",
    "/audio/roasts/sarcastic_04.mp3",
    "/audio/roasts/sarcastic_05.mp3",
  ],
};

export function moodToPremiumVoiceBucket(mood: string | null | undefined): PremiumVoiceMood {
  const m = (mood || "").toUpperCase();
  if (m === "PROUD" || m === "SWEET") return "proud";
  if (m === "SARCASTIC" || m === "ANNOYED") return "sarcastic";
  return "angry"; // ANGRY / FURIOUS / default
}

export function pickPremiumRoastUrl(
  mood: string | null | undefined,
  rand: () => number = Math.random,
): string {
  const bucket = moodToPremiumVoiceBucket(mood);
  const list = PREMIUM_ROAST_FILES[bucket];
  const idx = Math.max(0, Math.min(list.length - 1, Math.floor(rand() * list.length)));
  return list[idx]!;
}

export function allPremiumRoastUrls(): string[] {
  return [
    ...PREMIUM_ROAST_FILES.angry,
    ...PREMIUM_ROAST_FILES.proud,
    ...PREMIUM_ROAST_FILES.sarcastic,
  ];
}
