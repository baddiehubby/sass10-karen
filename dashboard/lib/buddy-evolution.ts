/**
 * ONE visible Buddy progression.
 * Local check-ins drive the default stage (works offline / free).
 * Server Soul stage (when tables exist) can only equal or advance — never punish free users.
 * Internal bondDepth is never exposed.
 */

import type { MoodCheckIn } from "@/lib/companion-mood";
import type { EvolutionStage } from "@/lib/buddy-soul-types";
import { uniqueDays } from "@/lib/orb-evolution";

export const EVOLUTION_STAGES: EvolutionStage[] = [
  "awakening",
  "familiar",
  "companion",
  "kindred",
  "cosmic",
];

export const EVOLUTION_LABEL: Record<EvolutionStage, string> = {
  awakening: "Awakening",
  familiar: "Familiar",
  companion: "Companion",
  kindred: "Kindred",
  cosmic: "Cosmic",
};

const RANK: Record<EvolutionStage, number> = {
  awakening: 0,
  familiar: 1,
  companion: 2,
  kindred: 3,
  cosmic: 4,
};

/** Presence-based stage from local check-ins — no paywall. */
export function localEvolutionStage(entries: MoodCheckIn[]): EvolutionStage {
  const days = uniqueDays(entries).length;
  const n = entries.length;
  if (days >= 45 || n >= 60) return "cosmic";
  if (days >= 21 || n >= 30) return "kindred";
  if (days >= 10 || n >= 14) return "companion";
  if (days >= 3 || n >= 3) return "familiar";
  return "awakening";
}

export function asEvolutionStage(value: string | null | undefined): EvolutionStage {
  const v = (value || "").toLowerCase();
  if (v === "familiar" || v === "companion" || v === "kindred" || v === "cosmic") return v;
  return "awakening";
}

/** Prefer the higher of local presence vs server soul (when available). */
export function reconcileEvolutionStage(
  entries: MoodCheckIn[],
  serverStage?: string | null,
): EvolutionStage {
  const local = localEvolutionStage(entries);
  if (!serverStage) return local;
  const server = asEvolutionStage(serverStage);
  return RANK[server] >= RANK[local] ? server : local;
}

export function evolutionClassName(stage: EvolutionStage): string {
  return `orb-${stage}`;
}

export function evolutionHint(stage: EvolutionStage): string {
  switch (stage) {
    case "cosmic":
      return "Your constellation has grown wide. Keep exploring at your pace.";
    case "kindred":
      return "Buddy's look has deepened with your rhythm — not a score.";
    case "companion":
      return "Familiar textures. Showing up shapes the glow.";
    case "familiar":
      return "A pattern is forming. No rush.";
    default:
      return "Just beginning. Beautiful already.";
  }
}
