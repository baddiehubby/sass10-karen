const HUMOR_LINES = [
  "Probably near food.",
  "Even the cosmos loses its keys sometimes.",
  "This may be enlightenment, or just excellent timing.",
  "Your aura suggests genius and hydration are both needed.",
  "Mercury is confused, but you are not.",
];

const BASE_BY_MOOD = {
  neutral: [
    "The stars suggest patience today. Something good ripens slowly.",
    "You are between waves. Breathe before you choose.",
  ],
  happy: [
    "Joy is visiting. Let it stay longer than your doubts.",
    "Your light is contagious today. Spend it wisely.",
  ],
  thinking: [
    "A clear answer is forming behind your quiet questions.",
    "You are not overthinking. You are refining.",
  ],
  concerned: [
    "You carried storms before. This one will also pass through you.",
    "Your caution is wisdom wearing armor.",
  ],
  excited: [
    "I see a door opening where you least expect it.",
    "Energy is rising. Aim it with intention, not urgency.",
  ],
  sleepy: [
    "Your spirit asks for gentleness before greatness.",
    "Rest is not delay. It is sacred preparation.",
  ],
  zen: [
    "Silence is speaking clearly to you today.",
    "The calm you feel is not empty. It is power at rest.",
  ],
  lit: [
    "Your fire is bright. Guard it from distraction.",
    "Momentum has found you. Keep your heart steady.",
  ],
  divine: [
    "A rare blessing is near. Receive more, force less.",
    "The golden thread is visible now. Follow it softly.",
  ],
};

function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function hashSeed(input) {
  const source = String(input || "sacha");
  let h = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function timeBand(hours) {
  if (hours < 6) return "night";
  if (hours < 12) return "morning";
  if (hours < 17) return "afternoon";
  if (hours < 21) return "evening";
  return "night";
}

const TIME_PREFIX = {
  morning: "Dawn whispers",
  afternoon: "Midday currents say",
  evening: "Twilight agrees",
  night: "The night sky insists",
};

const DAY_SPICE = ["Sunday blessing", "Monday discipline", "Tuesday courage", "Wednesday balance", "Thursday learning", "Friday flow", "Saturday release"];

export function createSachaPredictionEngine(seedInput) {
  const rand = seededRandom(hashSeed(seedInput));
  return {
    nextPrediction({ mood, now }) {
      const dt = now instanceof Date ? now : new Date();
      const m = BASE_BY_MOOD[mood] ? mood : "neutral";
      const lines = BASE_BY_MOOD[m];
      const line = lines[Math.floor(rand() * lines.length)];
      const band = timeBand(dt.getHours());
      const day = DAY_SPICE[dt.getDay()];
      const withHumor = rand() < 0.3;
      const humor = withHumor ? ` ${HUMOR_LINES[Math.floor(rand() * HUMOR_LINES.length)]}` : "";
      return `${TIME_PREFIX[band]}: ${line} ${day}.${humor}`.trim();
    },
  };
}

