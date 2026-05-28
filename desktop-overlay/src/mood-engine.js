/**
 * Local mood detection — keyword/heuristic only (no network, no npm sentiment).
 * Mirrors the widget's lightweight rules.
 */

const HAPPY_WORDS = ["amazing", "awesome", "great", "love", "perfect", "thanks", "wow", "excellent", "happy", "joy"];
const SAD_WORDS = [
  "wrong",
  "bad",
  "error",
  "fix",
  "broken",
  "hate",
  "terrible",
  "useless",
  "fail",
  "sad",
  "angry",
  "stress",
  "anxious",
  "worried",
];
const EXCITED_WORDS = ["incredible", "fantastic", "brilliant", "outstanding", "superb", "best", "win", "success"];
const QUESTION_WORDS = ["how", "what", "why", "explain", "help", "?"];
const SLEEPY_WORDS = ["sleep", "rest", "tired", "late", "exhausted", "fatigue", "nap"];
const CHILL_WORDS = ["chill", "relax", "calm", "meditat", "zen", "peace"];
const PARTY_WORDS = ["party", "celebrate", "lit", "fun"];

const POSITIVE_LEX = {
  love: 3,
  amazing: 3,
  awesome: 3,
  great: 2,
  good: 2,
  happy: 2,
  excellent: 3,
  wonderful: 3,
  beautiful: 2,
  thanks: 1,
  grateful: 2,
  calm: 2,
  peace: 2,
};
const NEGATIVE_LEX = {
  hate: -3,
  terrible: -3,
  awful: -3,
  bad: -2,
  wrong: -2,
  broken: -2,
  fail: -2,
  error: -2,
  sad: -2,
  angry: -2,
  stress: -2,
  anxious: -2,
  worried: -2,
  useless: -3,
};

function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function simpleSentimentScore(text) {
  const lower = normalizeText(text).toLowerCase();
  if (!lower) return 0;
  let score = 0;
  const tokens = lower.split(/[^a-z0-9']+/).filter(Boolean);
  for (const token of tokens) {
    if (POSITIVE_LEX[token]) score += POSITIVE_LEX[token];
    if (NEGATIVE_LEX[token]) score += NEGATIVE_LEX[token];
  }
  return score;
}

function includesAny(text, words) {
  return words.some((w) => text.includes(w));
}

function detectMoodFromText(text, previousMood, interactionCount) {
  const t = normalizeText(text).toLowerCase();
  if (!t) return previousMood || "neutral";

  if (interactionCount > 0 && interactionCount % 50 === 0) return "divine";

  const sentimentScore = simpleSentimentScore(t);
  if (sentimentScore >= 4) return "excited";
  if (sentimentScore >= 2) return "happy";
  if (sentimentScore <= -4) return "concerned";
  if (includesAny(t, SLEEPY_WORDS)) return "sleepy";
  if (includesAny(t, EXCITED_WORDS)) return "excited";
  if (includesAny(t, HAPPY_WORDS)) return "happy";
  if (includesAny(t, SAD_WORDS)) return "concerned";
  if (includesAny(t, QUESTION_WORDS)) return "thinking";
  if (includesAny(t, CHILL_WORDS)) return "zen";
  if (includesAny(t, PARTY_WORDS)) return "lit";
  return "neutral";
}

function detectMoodFromTimeOfDay(date) {
  const d = date instanceof Date ? date : new Date();
  const h = d.getHours();
  if (h >= 0 && h < 6) return "sleepy";
  if (h >= 6 && h < 10) return "zen";
  if (h >= 10 && h < 17) return "neutral";
  if (h >= 17 && h < 21) return "happy";
  return "thinking";
}

function cosmicSeedMood(seed) {
  const moods = ["neutral", "thinking", "zen", "happy", "lit"];
  let h = 2166136261;
  const s = String(seed || Date.now());
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return moods[(h >>> 0) % moods.length];
}

function detectMoodIdle(seed, tenant) {
  if (tenant === "sachapandit") {
    return cosmicSeedMood(seed);
  }
  return detectMoodFromTimeOfDay();
}

module.exports = {
  detectMoodFromText,
  detectMoodFromTimeOfDay,
  cosmicSeedMood,
  detectMoodIdle,
  normalizeText,
};
