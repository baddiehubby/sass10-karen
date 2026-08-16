/** Shared time-of-day theme tokens — no Three.js dependency. */

export type TimeTheme = "morning" | "afternoon" | "night";

export function getTimeTheme(hour = new Date().getHours()): TimeTheme {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "night";
}

export const TIME_THEME_COLORS: Record<
  TimeTheme,
  { primary: string; secondary: string; emissive: string; glow: string }
> = {
  morning: { primary: "#22d3ee", secondary: "#0ea5e9", emissive: "#06b6d4", glow: "rgba(34,211,238,0.18)" },
  afternoon: { primary: "#f59e0b", secondary: "#fbbf24", emissive: "#d97706", glow: "rgba(245,158,11,0.16)" },
  night: { primary: "#818cf8", secondary: "#a855f7", emissive: "#6366f1", glow: "rgba(129,140,248,0.2)" },
};
