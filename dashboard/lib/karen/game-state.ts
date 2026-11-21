/**
 * Knock-Out fight state — drain Karen's Patience before your Dignity hits 0.
 *
 * The game is rigged: her WAV counters hit harder than a landed scream,
 * and most screams miss. Users almost always eat the K.O. stamp.
 */

export const KAREN_PATIENCE_START = 100;
export const USER_DIGNITY_START = 100;

/** Landed scream — Karen recoils. */
export const USER_HIT_DAMAGE_MIN = 10;
export const USER_HIT_DAMAGE_MAX = 15;
/**
 * Chance a scream actually connects. Keep this well under 50% so Dignity
 * dies to her 20–25 counters long before Patience can empty.
 */
export const USER_SCREAM_HIT_CHANCE = 0.28;

/** Karen WAV response — always connects, always heavier than a user hit. */
export const KAREN_COUNTER_DAMAGE_MIN = 20;
export const KAREN_COUNTER_DAMAGE_MAX = 25;

/** Hesitate / say nothing — Karen takes 0. */
export const HESITATION_PATIENCE_DAMAGE = 0;

export const FIGHT_CHAOS_DIGNITY_THRESHOLD = 30;

export const WIN_KO_LINE = "Fine. You win this round. Get out of my sight.";
export const WIN_KO_SRC = "smackbacks/win_ko.wav";

export const USER_KO_LINE =
  "Game over. You lost. Not just to me, but to your own lack of discipline. I want you to take a long, hard look in the mirror. That person staring back? They're a failure. Now log off, and don't come back until you've actually done something with your life.";
export const USER_KO_SRC = "smackbacks/ko_final.wav";

export type KarenFighters = {
  karenPatience: number;
  userDignity: number;
};

export type KoOutcome = "fighting" | "user_ko" | "karen_ko";

export type ScreamHitRoll = {
  hit: boolean;
  damage: number;
};

export function createFightState(): KarenFighters {
  return {
    karenPatience: KAREN_PATIENCE_START,
    userDignity: USER_DIGNITY_START,
  };
}

export function clampBar(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function fightOutcome(fighters: KarenFighters): KoOutcome {
  if (fighters.userDignity <= 0) return "user_ko";
  if (fighters.karenPatience <= 0) return "karen_ko";
  return "fighting";
}

function rollInt(min: number, max: number, rng: () => number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Hold-to-scream: miss → 0 damage. Hit → 10–15 + physical recoil. */
export function rollUserScreamHit(rng: () => number = Math.random): ScreamHitRoll {
  if (rng() >= USER_SCREAM_HIT_CHANCE) {
    return { hit: false, damage: 0 };
  }
  return {
    hit: true,
    damage: rollInt(USER_HIT_DAMAGE_MIN, USER_HIT_DAMAGE_MAX, rng),
  };
}

export function rollHesitationDamage(): number {
  return HESITATION_PATIENCE_DAMAGE;
}

/** Every Karen WAV response. */
export function rollKarenCounterDamage(rng: () => number = Math.random): number {
  return rollInt(KAREN_COUNTER_DAMAGE_MIN, KAREN_COUNTER_DAMAGE_MAX, rng);
}

export function applyPatienceDamage(
  fighters: KarenFighters,
  damage: number,
): { fighters: KarenFighters; outcome: KoOutcome } {
  const karenPatience = clampBar(fighters.karenPatience - Math.max(0, damage));
  const next = { ...fighters, karenPatience };
  return { fighters: next, outcome: fightOutcome(next) };
}

export function applyDignityDamage(
  fighters: KarenFighters,
  damage: number,
): { fighters: KarenFighters; outcome: KoOutcome } {
  const userDignity = clampBar(fighters.userDignity - Math.max(0, damage));
  const next = { ...fighters, userDignity };
  return { fighters: next, outcome: fightOutcome(next) };
}
