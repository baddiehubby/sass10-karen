/**

 * Living Buddy feature flags — env override + defaults.

 * Disable independently without tearing down the SaaS.

 */



import { safeGetItem } from "@/lib/client-storage";



function envFlag(name: string, fallback: boolean): boolean {

  const raw = process.env[name]?.trim().toLowerCase();

  if (raw === "0" || raw === "false" || raw === "off") return false;

  if (raw === "1" || raw === "true" || raw === "on") return true;

  return fallback;

}



export const UNIVERSE_FLAGS = {

  livingBuddy: envFlag("NEXT_PUBLIC_FF_LIVING_BUDDY", true),

  moodUniverse: envFlag("NEXT_PUBLIC_FF_MOOD_UNIVERSE", true),

  oracleRealm: envFlag("NEXT_PUBLIC_FF_ORACLE_REALM", true),

  buddyEvolution: envFlag("NEXT_PUBLIC_FF_BUDDY_EVOLUTION", true),

  memoryConstellation: envFlag("NEXT_PUBLIC_FF_MEMORY_CONSTELLATION", true),

  dailyRitual: envFlag("NEXT_PUBLIC_FF_DAILY_RITUAL", true),

  vibeProfile: envFlag("NEXT_PUBLIC_FF_VIBE_PROFILE", true),

  orbEvolution: envFlag("NEXT_PUBLIC_FF_ORB_EVOLUTION", true),

  buddyMoments: envFlag("NEXT_PUBLIC_FF_BUDDY_MOMENTS", true),

  shareCards: envFlag("NEXT_PUBLIC_FF_SHARE_CARDS", true),

} as const;



export type UniverseWorld = "buddy" | "mood" | "oracle";



/** Privacy-safe client signal. No mood values, notes, or identity names. */

export function trackUniverse(event: string, props?: Record<string, string | number | boolean>) {

  if (typeof window === "undefined") return;

  try {

    if (safeGetItem("buddy_analytics_opt_in") !== "yes") return;

    window.dispatchEvent(new CustomEvent("buddy-universe-event", { detail: { event, props, t: Date.now() } }));

  } catch {

    /* private mode */

  }

}


