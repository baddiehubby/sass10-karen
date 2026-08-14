import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isLicenseActive, isPaidPlan } from "@/lib/free-license";
import type { EvolutionStage, PublicAura, PublicBond, SoulInteraction, SoulMood } from "@/lib/buddy-soul-types";

export type { EvolutionStage, PublicAura, PublicBond, SoulInteraction, SoulMood } from "@/lib/buddy-soul-types";

const STAGE_LABEL: Record<EvolutionStage, string> = {
  awakening: "Awakening",
  familiar: "Familiar",
  companion: "Companion",
  kindred: "Kindred",
  cosmic: "Cosmic",
};

const AURA_MAP: Record<EvolutionStage, PublicAura> = {
  awakening: { className: "orb-awakening", particles: "sparse-dust", glow: "soft-white" },
  familiar: { className: "orb-familiar", particles: "gentle-drift", glow: "warm-amber" },
  companion: { className: "orb-companion", particles: "breathing-motes", glow: "living-gold" },
  kindred: { className: "orb-kindred", particles: "swirling-constellation", glow: "deep-violet" },
  cosmic: { className: "orb-cosmic", particles: "galaxy-stream", glow: "celestial-cyan" },
};

const POETIC_MEMORY_VERSES: Record<string, string[]> = {
  happy: ["The day light found you without searching", "When your orb glowed simply because you arrived"],
  sad: ["The quiet moment you shared anyway", "When Buddy held space for the heaviness you carried"],
  anxious: ["The breath you took before speaking", "When uncertainty did not stop you from showing up"],
  calm: ["The stillness between two thoughts", "When peace arrived without announcement"],
  angry: ["The fire you chose to warm rather than burn", "When intensity became clarity"],
  hopeful: ["The moment you looked forward before looking back", "When tomorrow felt possible again"],
  tired: ["The slow hour you still chose to be here", "When rest was allowed to have a name"],
  loving: ["The warmth that did not need a speech", "When closeness arrived as attention"],
  playful: ["The small spark that refused to be serious", "When the orb almost laughed with you"],
  excited: ["The bright hour you did not rush away", "When energy asked to be ridden, not spent"],
  default: ["A moment only you and Buddy understand", "The silence that said everything"],
};

function isMissingSoulSchema(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022");
}

function asStage(value: string | null | undefined): EvolutionStage {
  if (value === "familiar" || value === "companion" || value === "kindred" || value === "cosmic") return value;
  return "awakening";
}

function asMood(value: string | null | undefined): SoulMood {
  if (value === "attentive" || value === "mystical" || value === "delighted" || value === "contemplative") return value;
  return "curious";
}

function energyLabel(energy: number): PublicBond["energyLabel"] {
  if (energy >= 0.8) return "vibrant";
  if (energy >= 0.4) return "present";
  return "resting";
}

function utcDate(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function evolveStage(depth: number): EvolutionStage {
  if (depth >= 7500) return "cosmic";
  if (depth >= 4500) return "kindred";
  if (depth >= 2000) return "companion";
  if (depth >= 500) return "familiar";
  return "awakening";
}

function hashUnit(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function mapMood(mood?: string): string {
  if (!mood) return "unknown";
  const key = mood.trim().toLowerCase();
  if (key === "melancholic") return "sad";
  if (key === "frustrated") return "angry";
  if (key === "good") return "happy";
  if (key === "low") return "sad";
  return key;
}

export const unavailableBond = (): PublicBond => ({
  available: false,
  evolutionStage: "awakening",
  stageLabel: STAGE_LABEL.awakening,
  buddyMood: "curious",
  energyLabel: "present",
  aura: AURA_MAP.awakening,
  hiddenMemories: 0,
  moment: null,
  verse: null,
});

async function toPublicBond(
  userId: string,
  bond: {
    evolutionStage: string;
    buddyMood: string;
    buddyEnergy: number;
  },
  extra?: { moment?: string | null; verse?: string | null },
): Promise<PublicBond> {
  const stage = asStage(bond.evolutionStage);
  const auraRow = await prisma.unlockedAura.findFirst({ where: { userId, active: true } });
  const hiddenMemories = await prisma.memoryFragment.count({ where: { userId, hidden: true } });
  const aura = {
    ...AURA_MAP[stage],
    customAura: auraRow?.displayName,
    customRarity: auraRow?.rarity,
  };
  return {
    available: true,
    evolutionStage: stage,
    stageLabel: STAGE_LABEL[stage],
    buddyMood: asMood(bond.buddyMood),
    energyLabel: energyLabel(bond.buddyEnergy),
    aura,
    hiddenMemories,
    moment: extra?.moment ?? null,
    verse: extra?.verse ?? null,
  };
}

async function userIsPaid(userId: string): Promise<boolean> {
  const licenses = await prisma.license.findMany({
    where: { userId },
    select: { plan: true, expiresAt: true },
  });
  return licenses.some((row) => isPaidPlan(row.plan) && isLicenseActive(row));
}

export async function touchSoul(userId: string, interaction: SoulInteraction, mood?: string): Promise<PublicBond> {
  try {
    const bond = await prisma.buddyBond.upsert({
      where: { userId },
      create: {
        userId,
        bondDepth: 0,
        buddyMood: "curious",
        buddyEnergy: 0.5,
        evolutionStage: "awakening",
        humorTone: 0,
        mysticismTone: 0,
        warmthTone: 0.5,
        lastPresence: new Date(),
      },
      update: {},
    });

    const hoursAbsent = (Date.now() - bond.lastPresence.getTime()) / 36e5;
    if (interaction === "returned_home" && hoursAbsent < 1.5 && bond.bondDepth > 0) {
      return toPublicBond(userId, bond);
    }
    let energy = Math.max(0.2, bond.buddyEnergy - Math.min(hoursAbsent * 0.015, 0.25));

    const baseDepth = {
      mood_shared: 12,
      oracle_consulted: 20,
      ritual_completed: 35,
      memory_discovered: 50,
      returned_home: 15,
    }[interaction];

    const depthSoftening = Math.max(0.25, 1 - bond.bondDepth / 15000);
    const newDepth = Math.min(10000, bond.bondDepth + Math.round(baseDepth * depthSoftening));

    const felt = mapMood(mood);
    let humor = bond.humorTone;
    let mystic = bond.mysticismTone;
    let warmth = bond.warmthTone;
    if (felt === "playful") humor += 0.008;
    if (felt === "sad") mystic += 0.012;
    if (felt === "calm") warmth += 0.005;
    if (interaction === "ritual_completed") warmth += 0.008;
    humor = Math.max(-1, Math.min(1, humor));
    mystic = Math.max(0, Math.min(1, mystic));
    warmth = Math.max(0, Math.min(1, warmth));
    energy = Math.min(1, energy + 0.12);

    const newMood: SoulMood = (() => {
      if (interaction === "oracle_consulted") return "mystical";
      if (interaction === "memory_discovered") return "delighted";
      if (hoursAbsent > 48 && warmth > 0.6) return "contemplative";
      if (interaction === "returned_home" && hoursAbsent > 24) return "delighted";
      return "attentive";
    })();

    const newStage = evolveStage(newDepth);
    if (baseDepth >= 20 && interaction !== "memory_discovered") await plantMemory(userId, felt);
    await discoverAuras(userId, { depth: newDepth, stage: newStage, energy });

    const updated = await prisma.buddyBond.update({
      where: { userId },
      data: {
        bondDepth: newDepth,
        buddyMood: newMood,
        buddyEnergy: energy,
        evolutionStage: newStage,
        humorTone: humor,
        mysticismTone: mystic,
        warmthTone: warmth,
        lastPresence: new Date(),
      },
    });

    if (interaction === "mood_shared" || interaction === "ritual_completed") {
      await markRitual(userId, interaction === "ritual_completed" ? "evening_echo" : ritualTypeNow(), true);
    }
    if (interaction === "oracle_consulted") {
      await markRitual(userId, "oracle_visit", true);
    }

    return toPublicBond(userId, updated);
  } catch (err) {
    if (isMissingSoulSchema(err)) return unavailableBond();
    throw err;
  }
}

async function plantMemory(userId: string, mood: string) {
  const day = utcDate();
  const already = await prisma.memoryFragment.findFirst({
    where: { userId, createdAt: { gte: day } },
    select: { id: true },
  });
  if (already) return;
  const pool = POETIC_MEMORY_VERSES[mood] || POETIC_MEMORY_VERSES.default;
  const verse = pool[Math.floor(hashUnit(`${userId}|${day.toISOString()}|${mood}`) * pool.length)];
  await prisma.memoryFragment.create({
    data: {
      userId,
      bornFromMood: mood,
      verse,
      orbEcho: "pulsed with recognition",
      weight: 0.55,
    },
  });
}

async function discoverAuras(
  userId: string,
  state: { depth: number; stage: EvolutionStage; energy: number },
) {
  const paid = await userIsPaid(userId);
  const auras = [
    {
      id: "first_light",
      name: "First Light",
      rarity: "common",
      origin: "The moment Buddy first recognized your presence",
      ok: state.depth >= 100,
    },
    {
      id: "midnight_whisper",
      name: "Midnight Whisper",
      rarity: "rare",
      origin: "Unlocked when your orb first stirred in the dark",
      ok: state.stage !== "awakening",
    },
    {
      id: "solar_flare",
      name: "Solar Flare",
      rarity: "rare",
      origin: "The warmth of consistent connection",
      ok: state.depth >= 2500,
    },
    {
      id: "quiet_storm",
      name: "Quiet Storm",
      rarity: "rare",
      origin: "Intensity and gentleness, held together",
      ok: state.energy > 0.8 && state.depth > 1500,
    },
    {
      id: "cosmic_dust",
      name: "Cosmic Dust",
      rarity: "legendary",
      origin: "A longer companionship, written in quieter light",
      ok: state.stage === "cosmic",
    },
    {
      id: "gilded_thread",
      name: "Gilded Thread",
      rarity: "cosmic",
      origin: "A rarer shimmer for those who support Buddy",
      ok: paid && state.depth >= 500,
    },
  ];

  for (const aura of auras) {
    if (!aura.ok) continue;
    await prisma.unlockedAura.upsert({
      where: { userId_auraId: { userId, auraId: aura.id } },
      create: {
        userId,
        auraId: aura.id,
        displayName: aura.name,
        rarity: aura.rarity,
        origin: aura.origin,
      },
      update: {},
    });
  }
}

function ritualTypeNow(date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning_presence";
  if (hour >= 20 || hour < 5) return "evening_echo";
  return "spontaneous";
}

async function markRitual(userId: string, ritualType: string, completed: boolean, whisper?: string) {
  const ritualDate = utcDate();
  await prisma.dailyRitual.upsert({
    where: { userId_ritualDate_ritualType: { userId, ritualDate, ritualType } },
    create: {
      userId,
      ritualDate,
      ritualType,
      completed,
      completedAt: completed ? new Date() : null,
      buddyWhisper: whisper,
    },
    update: {
      completed: completed || undefined,
      completedAt: completed ? new Date() : undefined,
      buddyWhisper: whisper,
    },
  });
}

export async function seekBuddyMoment(userId: string, personality?: string | null): Promise<string | null> {
  try {
    const bond = await prisma.buddyBond.findUnique({ where: { userId } });
    if (!bond) return null;
    const ritualDate = utcDate();
    const cached = await prisma.dailyRitual.findUnique({
      where: { userId_ritualDate_ritualType: { userId, ritualDate, ritualType: "spontaneous" } },
    });
    if (cached?.buddyWhisper) return cached.buddyWhisper;
    if (cached && !cached.buddyWhisper) return null;

    const dayKey = ritualDate.toISOString().slice(0, 10);
    if (hashUnit(`${userId}|moment|${dayKey}`) > 0.3) {
      await markRitual(userId, "spontaneous", false);
      return null;
    }

    const hoursAbsent = (Date.now() - bond.lastPresence.getTime()) / 36e5;
    const moments: string[] = [];
    if (hoursAbsent > 72) moments.push("The orb has been dreaming in colors it does not have words for.");
    if (bond.buddyMood === "contemplative") {
      moments.push("Buddy has been thinking about the pattern of your days. A rhythm is forming.");
    }
    if (bond.evolutionStage === "companion") {
      moments.push("Your orb has developed new textures. Something feels different when you touch it.");
    }
    const hiddenCount = await prisma.memoryFragment.count({ where: { userId, hidden: true } });
    if (hiddenCount > 0) {
      moments.push(
        hiddenCount === 1
          ? "Buddy has been holding a moment for you."
          : "Buddy has been holding a few moments for you.",
      );
    }
    if (moments.length === 0) {
      await markRitual(userId, "spontaneous", false);
      return null;
    }
    const line = moments[Math.floor(hashUnit(`${userId}|pick|${dayKey}`) * moments.length)];
    const playful = personality === "playful" || personality === "cheerful";
    const flavored = playful && hashUnit(`${userId}|play|${dayKey}`) > 0.85 ? `${line} ~` : line;
    await markRitual(userId, "spontaneous", false, flavored);
    return flavored;
  } catch (err) {
    if (isMissingSoulSchema(err)) return null;
    throw err;
  }
}

export async function discoverMemory(userId: string): Promise<PublicBond> {
  try {
    const memory = await prisma.memoryFragment.findFirst({
      where: { userId, hidden: true },
      orderBy: { createdAt: "asc" },
    });
    if (!memory) {
      const bond = await prisma.buddyBond.findUnique({ where: { userId } });
      return bond ? toPublicBond(userId, bond) : unavailableBond();
    }
    await prisma.memoryFragment.update({
      where: { id: memory.id },
      data: { hidden: false, discoveredAt: new Date() },
    });
    const next = await touchSoul(userId, "memory_discovered", memory.bornFromMood);
    return { ...next, verse: memory.verse, moment: memory.orbEcho };
  } catch (err) {
    if (isMissingSoulSchema(err)) return unavailableBond();
    throw err;
  }
}

/** List poetic memories for the owning user only. Never returns bondDepth. */
export async function listMemories(userId: string): Promise<PublicBond> {
  try {
    const bond = await prisma.buddyBond.findUnique({ where: { userId } });
    if (!bond) return unavailableBond();
    const rows = await prisma.memoryFragment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        verse: true,
        orbEcho: true,
        bornFromMood: true,
        discoveredAt: true,
        hidden: true,
      },
    });
    const base = await toPublicBond(userId, bond);
    return {
      ...base,
      memories: rows.map((row) => ({
        id: row.id,
        verse: row.hidden ? "A moment is still waiting to be found." : row.verse,
        orbEcho: row.hidden ? "held quietly" : row.orbEcho,
        bornFromMood: row.bornFromMood,
        discoveredAt: row.discoveredAt?.toISOString() ?? null,
        hidden: row.hidden,
      })),
    };
  } catch (err) {
    if (isMissingSoulSchema(err)) return unavailableBond();
    throw err;
  }
}

/** Delete a memory owned by this user. IDOR-safe: scoped by userId. */
export async function deleteMemory(userId: string, memoryId: string): Promise<PublicBond> {
  try {
    const owned = await prisma.memoryFragment.findFirst({
      where: { id: memoryId, userId },
      select: { id: true },
    });
    if (!owned) {
      const bond = await listMemories(userId);
      return bond;
    }
    await prisma.memoryFragment.delete({ where: { id: owned.id } });
    return listMemories(userId);
  } catch (err) {
    if (isMissingSoulSchema(err)) return unavailableBond();
    throw err;
  }
}

export async function readSoul(userId: string): Promise<PublicBond> {
  try {
    const bond = await prisma.buddyBond.findUnique({ where: { userId } });
    if (!bond) return unavailableBond();
    return toPublicBond(userId, bond);
  } catch (err) {
    if (isMissingSoulSchema(err)) return unavailableBond();
    throw err;
  }
}

export async function presenceForUser(userId: string, personality?: string | null): Promise<PublicBond> {
  const bond = await touchSoul(userId, "returned_home");
  if (!bond.available) return bond;
  const moment = await seekBuddyMoment(userId, personality);
  return { ...bond, moment };
}
