import type { MoodState } from "@/lib/companion-mood";
import { ARCHETYPES } from "@/lib/oracle/archetypes";
import { dayKey, hashSeed, pickFrom } from "@/lib/oracle/seed";
import {
  CAREER_LINES,
  ENERGY_LINES,
  FOCUS_LINES,
  FRIEND_LINES,
  GROWTH_LINES,
  LOVE_LINES,
  MONEY_LINES,
  MOVE_LINES,
  NOTICE_LINES,
  PANDIT_ENERGY,
  PANDIT_FOCUS,
  REFLECTION_LINES,
  TOMORROW_LINES,
  WEEK_LINES,
} from "@/lib/oracle/templates";

export type OracleReading = {
  dateKey: string;
  style: "cosmic" | "pandit";
  sign: string;
  energyLabel: string;
  energy: string;
  focus: string;
  notice: string;
  reflection: string;
  nextMove: string;
  love: string;
  career: string;
  money: string;
  friendships: string;
  growth: string;
  tomorrow: string;
  weekAhead: string;
  disclaimer: string;
};

export function interpretReading(
  state: MoodState,
  style: "cosmic" | "pandit",
  extraSeed = "",
  date = new Date(),
): OracleReading {
  const dateKey = dayKey(date);
  const seed = hashSeed(`${dateKey}|${state.mood}|${state.trend}|${style}|${extraSeed}`);
  const archetype = ARCHETYPES[state.mood];
  const disclaimer =
    "AI-powered reflection and entertainment. Not a prediction of fate, medical advice, or religious authority.";

  const extras = {
    love: pickFrom(LOVE_LINES, seed, 6),
    career: pickFrom(CAREER_LINES, seed, 7),
    money: pickFrom(MONEY_LINES, seed, 8),
    friendships: pickFrom(FRIEND_LINES, seed, 9),
    growth: pickFrom(GROWTH_LINES, seed, 10),
    tomorrow: pickFrom(TOMORROW_LINES, seed, 11),
    weekAhead: pickFrom(WEEK_LINES, seed, 12),
  };

  if (style === "pandit") {
    return {
      dateKey,
      style,
      sign: archetype.sign,
      energyLabel: "Today's संकेत",
      energy: pickFrom(PANDIT_ENERGY, seed, 1),
      focus: pickFrom(PANDIT_FOCUS, seed, 2),
      notice: pickFrom(NOTICE_LINES, seed, 3),
      reflection: pickFrom(REFLECTION_LINES, seed, 4),
      nextMove: pickFrom(MOVE_LINES, seed, 5),
      ...extras,
      disclaimer,
    };
  }

  return {
    dateKey,
    style,
    sign: archetype.sign,
    energyLabel: "Today's energy",
    energy: pickFrom(ENERGY_LINES, seed, 1),
    focus: pickFrom(FOCUS_LINES, seed, 2),
    notice: pickFrom(NOTICE_LINES, seed, 3),
    reflection: pickFrom(REFLECTION_LINES, seed, 4),
    nextMove: pickFrom(MOVE_LINES, seed, 5),
    ...extras,
    disclaimer,
  };
}
