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

const NEGATIVE_SELF_TALK = [
  { pattern: /\b(i'?m|i am)\s+(a\s+)?fail(ure|ing)?\b/i, response: "I disagree. You are a soul having a difficult moment. Those are not the same thing." },
  { pattern: /\b(i'?m|i am)\s+(worthless|useless|nothing|a\s+waste)\b/i, response: "I disagree. Your worth is not measured by this moment. I see more in you than you see right now." },
  { pattern: /\b(i\s+)?(hate|can'?t stand)\s+myself\b/i, response: "I disagree. Even on hard days, you are still worthy of gentleness — especially from yourself." },
  { pattern: /\b(nobody|no one)\s+(loves|cares about)\s+me\b/i, response: "I disagree. I am here with you. Presence is a form of love." },
  { pattern: /\bi\s+give\s+up\b/i, response: "I disagree. Rest is not surrender. Pause, breathe — you do not have to carry everything alone today." },
];

function getSubjectivityResponse(text) {
  const t = normalizeText(text);
  if (!t) return null;
  for (const rule of NEGATIVE_SELF_TALK) {
    if (rule.pattern.test(t)) return rule.response;
  }
  return null;
}

function summarizeWeekMood(history, days = 7) {
  const cutoff = Date.now() - days * 86400000;
  const counts = {};
  for (const e of history || []) {
    const ts = new Date(e.timestamp || e).getTime();
    if (Number.isNaN(ts) || ts < cutoff) continue;
    const mood = e.mood || "neutral";
    counts[mood] = (counts[mood] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : "calm";
}

function getMorningGreeting(history, yesterdayConcernedCount) {
  if (yesterdayConcernedCount >= 3) {
    return "You carried a heavy heart yesterday. Today, let me carry it with you.";
  }
  const weekMood = summarizeWeekMood(history, 7);
  const moodWord = weekMood === "concerned" ? "thoughtful" : weekMood;
  return `Yesterday you felt mostly ${moodWord}. Today, let your light shine.`;
}

const MILESTONE_DAYS = [7, 30, 100];
const MILESTONE_MESSAGES = {
  7: "Seven days together. Your companion remembers every mood. Would you like a weekly reflection?",
  30: "Thirty days of presence. You are building something rare — emotional continuity.",
  100: "One hundred days. A hundred emotional tides observed. Your spirit is evolving.",
};

function getMilestoneMessage(installDays, alreadyReached = []) {
  const reached = new Set(alreadyReached || []);
  for (const day of MILESTONE_DAYS) {
    if (installDays >= day && !reached.has(day)) return { day, message: MILESTONE_MESSAGES[day] };
  }
  return null;
}

module.exports = {
  detectMoodFromText,
  detectMoodFromTimeOfDay,
  cosmicSeedMood,
  detectMoodIdle,
  normalizeText,
  getSubjectivityResponse,
  getMorningGreeting,
  summarizeWeekMood,
  getMilestoneMessage,
  MILESTONE_DAYS,
};
