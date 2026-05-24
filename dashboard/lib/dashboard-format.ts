export function formatRelativeTime(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

const MOOD_PHRASES: Record<string, string> = {
  happy: "Felt happy",
  excited: "Lit up with excitement",
  neutral: "Felt calm and steady",
  thinking: "Paused to think deeply",
  concerned: "Sensed something uneasy",
  sleepy: "Grew quiet and sleepy",
  angry: "Felt tension in the air",
};

export function formatMomentSentence(mood: string, domain: string | null): string {
  const base = MOOD_PHRASES[mood] || `Felt ${mood}`;
  if (domain) return `${base} on ${domain}`;
  return base;
}

export function daysSince(date: Date): number {
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function pronounForName(name: string): "He's" | "She's" | "They're" {
  const n = name.trim().toLowerCase();
  if (!n || n === "buddy") return "They're";
  return "They're";
}
