import type { BuddyEmotion, BuddyIntent } from "@/src/intelligence/types";
import { scrubPromptInjection } from "@/src/intelligence/safety/prompt-injection";

const BLOCKED = [
  /\bkill myself\b/i,
  /\bsuicide\b/i,
  /\bself[-\s]?harm\b/i,
  /\bend my life\b/i,
];

export function detectsCrisisLanguage(text: string): boolean {
  return BLOCKED.some((re) => re.test(text));
}

/** Soft safety framing — not clinical care. */
export function safetyOverlay(text: string, intent: BuddyIntent, emotion: BuddyEmotion): string {
  if (detectsCrisisLanguage(text)) {
    return "I'm glad you told me. I'm not a crisis service — if you're in danger, please reach someone who can help right now (for example local emergency services or https://www.iasp.info/suicidalthoughts/). I'm here for company, not medical care.";
  }
  if ((intent === "anxiety" || intent === "sadness" || emotion === "heavy") && text.length > 120) {
    return `${text} And just so you know — I'm a companion, not a therapist.`;
  }
  return text;
}

export function sanitizeUserText(raw: string, max = 800): string {
  return scrubPromptInjection(raw, max);
}

export { scrubPromptInjection, looksLikePromptInjection } from "@/src/intelligence/safety/prompt-injection";
