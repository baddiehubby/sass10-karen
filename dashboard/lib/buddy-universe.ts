import { intelligentCheckInReply } from "@/lib/buddy-intelligence";
import { deriveMoodState, type BuddyMood, type MoodCheckIn } from "@/lib/companion-mood";
import { loadIdentity, localDayKey, saveIdentity, type AuraId, type BuddyIdentity } from "@/lib/buddy-identity";
import { pickBuddyMoment, type BuddyMoment } from "@/lib/buddy-moments";
import { ritualWindow } from "@/lib/daily-ritual";
import { loadCheckIns, saveCheckIn, updateLatestCheckIn } from "@/lib/mood-memory";
import { auraDef, newestUnlock, unlockedAuras } from "@/lib/orb-evolution";
import { trackUniverse } from "@/lib/universe-flags";
import { deriveVibeProfile, type VibeProfile } from "@/lib/vibe-profile";

export type UniverseSnapshot = {
  identity: BuddyIdentity;
  entries: MoodCheckIn[];
  vibe: VibeProfile;
  unlockTitle: string | null;
  moment: BuddyMoment | null;
};

function syncUnlocks(identity: BuddyIdentity, entries: MoodCheckIn[], now = new Date()): BuddyIdentity {
  const nextUnlocked = unlockedAuras(entries, identity.oracleVisits, now);
  const fresh = newestUnlock(identity.unlocked, nextUnlocked);
  const next: BuddyIdentity = {
    ...identity,
    unlocked: nextUnlocked,
    auraId: nextUnlocked.includes(identity.auraId) ? identity.auraId : "ember",
  };
  if (fresh) {
    next.auraId = fresh;
    next.lastUnlockId = fresh;
    next.lastUnlockAt = now.toISOString();
    trackUniverse("buddy_unlock", { aura: fresh });
  }
  return next;
}

function persistIfChanged(prev: BuddyIdentity, next: BuddyIdentity): BuddyIdentity {
  if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
  return saveIdentity(next);
}

export function freshUnlockTitle(identity: BuddyIdentity, now = new Date()): string | null {
  if (!identity.lastUnlockId || !identity.lastUnlockAt) return null;
  const at = new Date(identity.lastUnlockAt).getTime();
  if (!Number.isFinite(at) || now.getTime() - at > 2 * 60 * 1000) return null;
  return auraDef(identity.lastUnlockId).title;
}

export function loadUniverse(): UniverseSnapshot {
  const entries = loadCheckIns();
  const current = loadIdentity();
  const identity = persistIfChanged(current, syncUnlocks(current, entries));
  return {
    identity,
    entries,
    vibe: deriveVibeProfile(entries),
    unlockTitle: freshUnlockTitle(identity),
    moment: null,
  };
}

export function recordBuddyCheckIn(mood: BuddyMood, note?: string): UniverseSnapshot {
  const entries = saveCheckIn({
    id: `${Date.now()}`,
    mood,
    intensity: 55,
    note,
    createdAt: new Date().toISOString(),
  });
  const now = new Date();
  const window = ritualWindow(now.getHours());
  const day = localDayKey(now);
  let identity = syncUnlocks(loadIdentity(), entries, now);
  if (window === "morning") identity = { ...identity, lastMorningRitual: day };
  if (window === "evening") identity = { ...identity, lastEveningRitual: day };
  const state = deriveMoodState(entries);
  const moment = pickBuddyMoment(entries, identity, state.trend, now);
  if (moment) {
    identity = {
      ...identity,
      lastMomentId: moment.id,
      lastMomentAt: now.toISOString(),
      seenMomentIds: [...identity.seenMomentIds, moment.id].slice(-24),
    };
  }
  saveIdentity(identity);
  trackUniverse("buddy_checkin", { window, hasNote: Boolean(note) });
  return {
    identity,
    entries,
    vibe: deriveVibeProfile(entries),
    unlockTitle: freshUnlockTitle(identity, now),
    moment,
  };
}

export function recordCheckInNote(note: string): MoodCheckIn[] {
  return updateLatestCheckIn({ note: note.trim() || undefined });
}

export function recordOracleVisit(): BuddyIdentity {
  const identity = loadIdentity();
  const day = localDayKey();
  const alreadyToday = identity.lastOracleAt && localDayKey(new Date(identity.lastOracleAt)) === day;
  if (alreadyToday) return identity;
  const next = syncUnlocks(
    {
      ...identity,
      oracleVisits: identity.oracleVisits + 1,
      lastOracleAt: new Date().toISOString(),
    },
    loadCheckIns(),
  );
  saveIdentity(next);
  trackUniverse("buddy_oracle_open", { visits: next.oracleVisits });
  return next;
}

export function selectAura(auraId: AuraId): BuddyIdentity {
  const identity = loadIdentity();
  if (!identity.unlocked.includes(auraId)) return identity;
  return saveIdentity({ ...identity, auraId });
}

export function setIntention(text: string): BuddyIdentity {
  return saveIdentity({
    ...loadIdentity(),
    intention: { date: localDayKey(), text },
  });
}

export function checkInReply(mood: BuddyMood): string {
  return intelligentCheckInReply(mood);
}

export type ShareKind = "vibe" | "energy" | "oracle" | "constellation" | "week" | "milestone";

export function shareCopy(kind: ShareKind, input: { title: string; line: string }): string {
  const labels: Record<ShareKind, string> = {
    vibe: "MY BUDDY VIBE",
    energy: "TODAY'S ENERGY",
    oracle: "MY ORACLE",
    constellation: "MY MOOD CONSTELLATION",
    week: "7 DAYS WITH BUDDY",
    milestone: "BUDDY MILESTONE",
  };
  return `${labels[kind]}\n${input.title}\n${input.line}`;
}
