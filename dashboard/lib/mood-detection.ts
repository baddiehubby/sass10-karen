export type BuddyMood = "neutral" | "happy" | "thinking" | "concerned" | "excited" | "sleepy";

const HAPPY_WORDS = ["amazing", "awesome", "great", "love", "perfect", "thanks", "wow", "excellent"];
const CONCERNED_WORDS = ["wrong", "bad", "error", "fix", "broken", "hate", "terrible", "useless"];
const EXCITED_WORDS = ["incredible", "fantastic", "brilliant", "outstanding", "superb", "best"];
const THINKING_WORDS = ["how", "what", "why", "explain", "help", "?"];
const SLEEPY_WORDS = ["sleep", "rest", "tired", "late", "exhausted", "fatigue", "nap"];

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim().toLowerCase();
}

export function detectMoodFromText(text: string, fallback: BuddyMood = "neutral"): BuddyMood {
  const normalized = normalizeText(text);
  if (!normalized) return fallback;
  if (SLEEPY_WORDS.some((token) => normalized.includes(token))) return "sleepy";
  if (EXCITED_WORDS.some((token) => normalized.includes(token))) return "excited";
  if (HAPPY_WORDS.some((token) => normalized.includes(token))) return "happy";
  if (CONCERNED_WORDS.some((token) => normalized.includes(token))) return "concerned";
  if (THINKING_WORDS.some((token) => normalized.includes(token))) return "thinking";
  return "neutral";
}
