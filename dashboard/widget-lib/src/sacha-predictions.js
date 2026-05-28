const HUMOR_LINES = [
  "Probably near food.",
  "Even the cosmos loses its keys sometimes.",
  "This may be enlightenment, or just excellent timing.",
  "Your aura suggests genius and hydration are both needed.",
  "Mercury is confused, but you are not.",
  "The moon approves your chaos, conditionally.",
  "If this is a life lesson, at least it has good lighting.",
  "Today is spiritually premium, financially optional.",
  "The stars are dramatic, but they mean well.",
  "Your destiny is loading... without a progress bar.",
];

const BASE_BY_MOOD = {
  neutral: [
    "The stars suggest patience today. Something good ripens slowly.",
    "You are between waves. Breathe before you choose.",
    "A quiet answer will arrive when you stop chasing loud ones.",
    "Your steadiness is not boring. It is sacred architecture.",
    "The next step is simple. Simplicity is a blessing.",
    "Still water reflects true faces.",
  ],
  happy: [
    "Joy is visiting. Let it stay longer than your doubts.",
    "Your light is contagious today. Spend it wisely.",
    "Your laughter is medicine for more than one soul.",
    "Celebrate this small win; it is building a great one.",
    "Happiness is your compass, not your destination.",
    "Let gratitude lead the next decision.",
  ],
  thinking: [
    "A clear answer is forming behind your quiet questions.",
    "You are not overthinking. You are refining.",
    "Truth likes patient minds.",
    "Clarity is nearby; stop negotiating with fear.",
    "You already know the pattern. Trust your seeing.",
    "The wise path is usually quieter than the loud one.",
  ],
  concerned: [
    "You carried storms before. This one will also pass through you.",
    "Your caution is wisdom wearing armor.",
    "You are safe enough to exhale.",
    "I disagree. You are a soul having a difficult moment, not a failure.",
    "Fear can visit, but it does not get a permanent room.",
    "What feels heavy now is training your compassion.",
  ],
  excited: [
    "I see a door opening where you least expect it.",
    "Energy is rising. Aim it with intention, not urgency.",
    "Your momentum is real. Pair it with discipline.",
    "This spark wants structure. Give it a container.",
    "Act boldly, then check your heart once more.",
    "A brave yes is forming in you.",
  ],
  sleepy: [
    "Your spirit asks for gentleness before greatness.",
    "Rest is not delay. It is sacred preparation.",
    "The soul repairs in stillness.",
    "Tonight, softness is your strategy.",
    "Sleep is the temple where tomorrow is built.",
    "Close one loop, then close your eyes.",
  ],
  zen: [
    "Silence is speaking clearly to you today.",
    "The calm you feel is not empty. It is power at rest.",
    "Peace is not passive. It is precise.",
    "Hold this stillness; it is a rare teacher.",
    "Your breath is currently wiser than your inbox.",
    "Harmony is your strongest signal now.",
  ],
  lit: [
    "Your fire is bright. Guard it from distraction.",
    "Momentum has found you. Keep your heart steady.",
    "Radiance is here; use it for service.",
    "You are entering a high-voltage chapter.",
    "Say yes to the brave task.",
    "The room changes when you commit.",
  ],
  divine: [
    "A rare blessing is near. Receive more, force less.",
    "The golden thread is visible now. Follow it softly.",
    "This is a transcendent minute. Notice who you become in it.",
    "Heaven is not far; it is briefly very near.",
    "A sacred coincidence is arranging itself around you.",
    "The universe just nodded. Continue.",
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
const CRYPTIC_LINES = [
  "The river does not ask the mountain for directions. But it finds the sea.",
  "A locked gate and an open heart rarely coexist for long.",
  "When the lamp is trimmed, the path appears.",
  "You are not late; you are being ripened.",
  "Some answers arrive only when spoken less.",
];

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
      const cryptic = rand() < 0.05 ? ` ${CRYPTIC_LINES[Math.floor(rand() * CRYPTIC_LINES.length)]}` : "";
      return `${TIME_PREFIX[band]}: ${line} ${day}.${humor}${cryptic}`.trim();
    },
  };
}

