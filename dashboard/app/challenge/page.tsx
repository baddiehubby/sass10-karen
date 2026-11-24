import Link from "next/link";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChallengeClient } from "./challenge-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "7-Day Buddy Challenge",
  description:
    "Your AI has feelings. Take the 7-day Buddie Challenge and get a hilarious shareable emotional report card.",
  alternates: { canonical: "/challenge" },
};

export default async function ChallengePage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { companionName: true },
      })
    : null;

  const licenses =
    userId == null
      ? []
      : await prisma.license.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { id: true, key: true },
          take: 20,
        });

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-14">
      <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddy AI · viral growth</p>
      <h1 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">
        Your AI Has Feelings. We Can Prove It.
      </h1>
      <p className="mt-5 text-lg text-slate-300">
        Take the 7-Day Buddy Challenge – embed your companion, collect emotional data, and get a hilarious, shareable
        Emotional Report Card.
      </p>

      <div className="mt-8 flex justify-center">
        <div className="buddy-hero-shell">
          <div className="buddy-hero-orb" aria-hidden />
        </div>
      </div>

      <ol className="mt-10 space-y-4 text-slate-200">
        <li className="glass-panel flex gap-4 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
            🚀
          </span>
          <div>
            <p className="font-semibold text-white">Sign up free &amp; grab your embed</p>
            <p className="mt-1 text-sm text-slate-400">
              Humanize your AI in one line of code — your Buddy starts listening immediately.
            </p>
            <Link href="/register" className="mt-2 inline-block text-sm text-indigo-300 hover:underline">
              Create account →
            </Link>
          </div>
        </li>
        <li className="glass-panel flex gap-4 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
            📊
          </span>
          <div>
            <p className="font-semibold text-white">Run it on your AI chat for 7 days</p>
            <p className="mt-1 text-sm text-slate-400">
              Let users feel a soul beside the thread while Buddy streams anonymous mood analytics to your dashboard.
            </p>
          </div>
        </li>
        <li className="glass-panel flex gap-4 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
            🧾
          </span>
          <div>
            <p className="font-semibold text-white">Generate your AI&apos;s Emotional Report Card</p>
            <p className="mt-1 text-sm text-slate-400">
              Playful PDF: mood stats, a generated AI horoscope, and Buddy&apos;s advice — built for screenshots and
              shares.
            </p>
          </div>
        </li>
      </ol>

      <div className="mt-12">
        <ChallengeClient
          licenses={licenses.map((l) => ({ id: l.id, label: `…${l.key.slice(-6)}` }))}
          companionName={user?.companionName?.trim() || "Buddy"}
        />
      </div>
    </main>
  );
}
