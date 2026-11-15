import type { Metadata } from "next";

import { KarenChatShell } from "./karen-chat-shell";
import { karenFreeMessagesUsedToday } from "@/lib/karen/vip";
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/session-user";

export const metadata: Metadata = {
  title: "Karen VIP | Accountability Coach",
  description: "Level 10 Sass AI accountability coach — $19/mo premium experience.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Premium mobile-first Karen shell.
 * Server-reads `user.isPremium` for the $19 Lemon Squeezy paywall gate.
 */
export default async function KarenPage() {
  const userId = await sessionUserId();
  let initialIsPremium = false;
  let initialChatCount = 0;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isPremium: true,
        karenChatCount: true,
        karenChatDay: true,
      },
    });
    initialIsPremium = Boolean(user?.isPremium);
    initialChatCount = karenFreeMessagesUsedToday(user ?? {});
  }

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-black text-white">
      <KarenChatShell
        initialIsPremium={initialIsPremium}
        initialChatCount={initialChatCount}
      />
    </div>
  );
}
