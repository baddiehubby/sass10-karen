import { greetingLine, type CompanionPersonality } from "@/lib/companion-mood";
import { localDayKey, type BuddyIdentity } from "@/lib/buddy-identity";

export type RitualWindow = "morning" | "evening" | "open";

export const INTENTION_CHIPS = [
  "Be gentle",
  "One honest thing",
  "Protect an hour",
  "Stay curious",
  "Rest without earning it",
] as const;

export function ritualWindow(hour = new Date().getHours()): RitualWindow {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 20 || hour < 5) return "evening";
  return "open";
}

export function ritualPrompt(window: RitualWindow, name: string, personality: CompanionPersonality): string {
  if (window === "morning") return "Good morning. What's your vibe?";
  if (window === "evening") return "Before you disappear... how was today?";
  return greetingLine(name, personality);
}

export function ritualDoneToday(identity: BuddyIdentity, window: RitualWindow, now = new Date()): boolean {
  const day = localDayKey(now);
  if (window === "morning") return identity.lastMorningRitual === day;
  if (window === "evening") return identity.lastEveningRitual === day;
  return false;
}

export function todaysIntention(identity: BuddyIdentity, now = new Date()): string | null {
  if (!identity.intention) return null;
  return identity.intention.date === localDayKey(now) ? identity.intention.text : null;
}
