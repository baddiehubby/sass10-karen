import { prisma } from "@/lib/prisma";

const SEED_BADGES = [
  { name: "First Smile", description: "First happy mood detected.", icon: "😊", condition: "first_happy" },
  { name: "100 Conversations", description: "Logged 100 mood events.", icon: "💬", condition: "events_100" },
  { name: "Mood Master", description: "Triggered all 6 moods.", icon: "🎭", condition: "all_moods" },
  { name: "Embedded on 10 Sites", description: "Seen on 10 distinct domains.", icon: "🌐", condition: "domains_10" },
  { name: "Pro Companion", description: "Upgraded to Pro or above.", icon: "🚀", condition: "plan_pro" },
  { name: "Agency Legend", description: "Unlocked agency plan.", icon: "👑", condition: "plan_agency" },
] as const;

let seeded = false;
export async function ensureBadgeSeeds() {
  if (seeded) return;
  for (const badge of SEED_BADGES) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      update: {},
      create: badge,
    });
  }
  seeded = true;
}

export async function awardBadgeByName(userId: string, name: string) {
  await ensureBadgeSeeds();
  const badge = await prisma.badge.findUnique({ where: { name }, select: { id: true } });
  if (!badge) return;
  await prisma.userBadge.upsert({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
    update: {},
    create: { userId, badgeId: badge.id },
  });
}
