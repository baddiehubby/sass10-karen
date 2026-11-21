import type { Metadata } from "next";

import { loadKarenAccountabilityState } from "@/app/karen/actions";
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/session-user";
import { resolveKarenPremium } from "@/lib/karen/vip";

import { KarenDashboardClient } from "./karen-dashboard-client";

export const metadata: Metadata = {
  title: {
    absolute: "Karen · Accountability Loop",
  },
  description: "Goal Tracker — daily commitments, 8 PM Karen interrogation, YES/NO consequences.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Premium Accountability Loop dashboard.
 * TEMPORARY: hard VIP bypass in local development.
 */
export default async function KarenDashboardPage() {
  const userId = await sessionUserId();
  let userIsPremium = false;
  let serverState = null;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPremium: true },
    });
    userIsPremium = Boolean(user?.isPremium);
    serverState = await loadKarenAccountabilityState();
  }

  // Prisma `isPremium` (set by the Lemon webhook) — the dev-only VIP bypass is applied
  // inside resolveKarenPremium and is hard-off in production.
  const isPremium = resolveKarenPremium(userIsPremium);

  return (
    <KarenDashboardClient
      isPremium={isPremium}
      isSignedIn={Boolean(userId)}
      initialServerState={serverState}
    />
  );
}
