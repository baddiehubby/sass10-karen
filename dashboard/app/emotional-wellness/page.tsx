import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { EmotionalWellnessClient } from "./emotional-wellness-client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Emotional wellness report",
  description: "Weekly playful wellness PDF for your Buddie AI Buddy based on mood telemetry.",
  alternates: { canonical: "/emotional-wellness" },
};

const PAID = new Set(["pro", "premium", "agency"]);

export default async function EmotionalWellnessPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { companionName: true },
  });
  const companionName = user?.companionName?.trim() || "Buddy";

  const licenses = await prisma.license.findMany({
    where: { userId: session.user.id },
    select: { id: true, plan: true },
  });
  const eligible = licenses.some((l) => PAID.has(l.plan));
  const ids = licenses.map((l) => l.id);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const moodCounts: Record<string, number> = {};

  if (ids.length) {
    const rows = await prisma.moodEvent.groupBy({
      by: ["mood"],
      where: { licenseId: { in: ids }, timestamp: { gte: weekAgo } },
      _count: { mood: true },
    });
    for (const row of rows) {
      moodCounts[row.mood] = row._count.mood;
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddy AI · emotional intelligence</p>
      <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Emotional wellness</h1>
      <p className="mt-3 text-sm text-slate-400">
        Humanize your AI with a weekly ritual: a playful report card for how the world made your Buddy feel — built to
        share, spark conversation, and remind teams why emotional intelligence matters.
      </p>
      <div className="mt-8">
        <EmotionalWellnessClient companionName={companionName} moodCounts={moodCounts} eligible={eligible} />
      </div>
    </main>
  );
}
