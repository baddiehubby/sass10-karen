import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/session-user";
import { resolveKarenPremium } from "@/lib/karen/vip";

import { KarenPlannerClient } from "./karen-planner-client";

export const metadata: Metadata = {
  title: {
    absolute: "Toxic Planner · SASS10",
  },
  description:
    "Lock what you're avoiding. Miss the deadline and face the consequences.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Toxic Planner — localStorage `karen_planner`.
 * Non-VIP: blur + $20 Lemon Prove Your Worth paywall before Lock it in.
 * Overdue → Face the consequences → `/karen?failedTask=` (client fight loop).
 */
export default async function KarenPlannerPage() {
  const userId = await sessionUserId();
  let userIsPremium = false;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPremium: true },
    });
    userIsPremium = Boolean(user?.isPremium);
  }

  return (
    <KarenPlannerClient isPremium={resolveKarenPremium(userIsPremium)} />
  );
}
