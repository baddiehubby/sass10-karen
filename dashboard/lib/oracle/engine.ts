import { deriveMoodState, type MoodCheckIn, type MoodState } from "@/lib/companion-mood";
import { interpretReading, type OracleReading } from "@/lib/oracle/interpreter";

export function buildOracleReading(
  checkIns: MoodCheckIn[],
  style: "cosmic" | "pandit",
  extraSeed = "",
  date?: Date,
): { state: MoodState; reading: OracleReading } {
  const state = deriveMoodState(checkIns);
  return { state, reading: interpretReading(state, style, extraSeed, date) };
}

export type { OracleReading };
