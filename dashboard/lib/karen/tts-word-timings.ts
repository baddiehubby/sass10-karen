/**
 * Estimate per-word timing for TalkingHead.speakAudio when the TTS provider
 * does not return alignment data.
 */

export type WordTimings = {
  words: string[];
  wtimes: number[];
  wdurations: number[];
};

/** Split into speakable tokens (words + light punctuation kept with words). */
export function tokenizeSpeechWords(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  return clean.match(/\S+/g) ?? [clean];
}

/**
 * Distribute `durationMs` across words by character weight (longer words → longer slots).
 */
export function buildWordTimings(text: string, durationMs: number): WordTimings {
  const words = tokenizeSpeechWords(text);
  if (!words.length) {
    return { words: [""], wtimes: [0], wdurations: [Math.max(100, durationMs)] };
  }

  const totalChars = words.reduce((sum, w) => sum + Math.max(1, w.replace(/[^\w]/g, "").length || w.length), 0);
  const leadIn = 40;
  const trail = 80;
  const usable = Math.max(words.length * 60, durationMs - leadIn - trail);
  const gap = 18;

  const wtimes: number[] = [];
  const wdurations: number[] = [];
  let t = leadIn;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const weight = Math.max(1, w.replace(/[^\w]/g, "").length || w.length);
    const share = weight / totalChars;
    const dur = Math.max(70, share * usable - gap);
    wtimes.push(Math.round(t));
    wdurations.push(Math.round(dur));
    t += dur + gap;
  }

  return { words, wtimes, wdurations };
}
