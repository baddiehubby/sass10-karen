"use client";

/**
 * Toxic Planner — lock what you're avoiding; miss the deadline → Face the consequences.
 * Persists to localStorage `karen_planner` as `{ id, task, deadline, completed }[]`.
 * Free users: blur + $20 Lemon Prove Your Worth before any save.
 */

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ProveYourWorthModal } from "@/components/karen/prove-your-worth-modal";
import { VipAccessBadge } from "@/components/karen/vip-access-badge";
import {
  addPlannerTask,
  formatPlannerDeadline,
  isPlannerTaskOverdue,
  readPlannerTasks,
  removePlannerTask,
  updatePlannerTask,
  type PlannerTask,
} from "@/lib/karen/planner";
import { trackPaywallHit } from "@/lib/karen/analytics";
import { resolveKarenPremium } from "@/lib/karen/vip";
import {
  bumpVipTrustInteraction,
  hasVipTrustPremium,
  isVipTrustActive,
  readVipTrustState,
  shouldShowVipTrustBadge,
  VIP_TRUST_GOAL_LINE,
  VIP_TRUST_GOAL_SRC,
} from "@/lib/karen/vip-trust";
import {
  getRegisteredKarenTalkingHead,
  playWavWithLipsync,
  unlockKarenAudio,
} from "@/lib/karen/voice";

function toDatetimeLocalValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultDeadlineLocal(): string {
  return toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
}

type KarenPlannerClientProps = {
  isPremium?: boolean;
};

export function KarenPlannerClient({
  isPremium: initialIsPremium = false,
}: KarenPlannerClientProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [avoiding, setAvoiding] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadlineLocal);
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);
  const [isPremium, setIsPremium] = useState(initialIsPremium);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [vipBadge, setVipBadge] = useState(false);

  useEffect(() => {
    setTasks(readPlannerTasks());
    const real = resolveKarenPremium(initialIsPremium);
    const trust = readVipTrustState();
    const premium = hasVipTrustPremium(real, trust);
    setIsPremium(premium);
    setVipBadge(shouldShowVipTrustBadge(trust));
    setHydrated(true);
    if (!premium) {
      setPaywallOpen(true);
      trackPaywallHit("toxic_planner");
    }
  }, [initialIsPremium]);

  // Re-evaluate overdue state without a full remount.
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const openCount = useMemo(
    () => tasks.filter((t) => !t.completed).length,
    [tasks],
  );

  // `tick` forces overdue re-evaluation on an interval.
  const nowMs = Date.now() + tick * 0;
  const locked = !isPremium;

  const demandPremium = useCallback(() => {
    setPaywallOpen(true);
    trackPaywallHit("toxic_planner");
  }, []);

  const onLockIn = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!isPremium) {
        demandPremium();
        return;
      }
      const task = avoiding.replace(/\s+/g, " ").trim();
      if (!task || !deadline) return;
      const iso = new Date(deadline).toISOString();
      if (Number.isNaN(Date.parse(iso))) return;
      addPlannerTask({ task, deadline: iso });
      setTasks(readPlannerTasks());
      setAvoiding("");
      setDeadline(defaultDeadlineLocal());

      // VIP Trust — supportive but strict goal line (counts as a soft interaction).
      if (isVipTrustActive()) {
        const n = bumpVipTrustInteraction();
        setVipBadge(n < 3);
        setIsPremium(
          hasVipTrustPremium(resolveKarenPremium(initialIsPremium)),
        );
        void (async () => {
          try {
            const head = getRegisteredKarenTalkingHead();
            await unlockKarenAudio(head);
            await playWavWithLipsync(VIP_TRUST_GOAL_SRC, head, {
              text: VIP_TRUST_GOAL_LINE,
              volume: 0.95,
            });
          } catch (err) {
            console.warn("[vip-trust] planner goal line failed", err);
          }
        })();
      }
    },
    [avoiding, deadline, demandPremium, initialIsPremium, isPremium],
  );

  const onFaceConsequences = useCallback(
    (row: PlannerTask) => {
      // Enforcement always routes into the fight — paywall lives on Lock it in.
      router.push("/karen?failedTask=" + encodeURIComponent(row.task));
    },
    [router],
  );

  return (
    <div
      className="karen-vh relative mx-auto flex h-full w-full max-w-lg flex-col overflow-y-auto overscroll-contain bg-black px-4 py-8 text-white"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a0508 0%, #050505 50%, #000 100%)",
      }}
      data-karen-planner=""
    >
      <VipAccessBadge show={vipBadge} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#ff2d55]">
            SASS10 · Enforcement
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Toxic Planner
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
            Lock what you&apos;re dodging. Miss the deadline and face the
            consequences.
          </p>
        </div>
        <Link
          href="/karen"
          className="shrink-0 rounded-full border border-[#ff2d55]/35 bg-black/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff8fa3] transition hover:border-[#ff2d55] hover:text-white"
        >
          Fight
        </Link>
      </div>

      <div
        className={`relative mt-8 transition-[filter] ${
          locked ? "pointer-events-none select-none blur-[7px]" : ""
        }`}
        aria-hidden={locked || undefined}
      >
        <form
          onSubmit={onLockIn}
          className="space-y-4 rounded-3xl border border-[#ff2d55]/30 bg-black/80 p-5 shadow-[0_0_60px_rgba(255,45,85,0.22)]"
        >
          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">
              What are you avoiding today?
            </span>
            <input
              type="text"
              value={avoiding}
              onChange={(e) => setAvoiding(e.target.value)}
              placeholder="Go to the gym"
              maxLength={160}
              className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#ff2d55]/80 focus:ring-2 focus:ring-[#ff2d55]/35"
              required
              tabIndex={locked ? -1 : 0}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">
              Deadline
            </span>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3.5 text-sm text-white outline-none focus:border-[#ff2d55]/80 focus:ring-2 focus:ring-[#ff2d55]/35 [color-scheme:dark]"
              required
              tabIndex={locked ? -1 : 0}
            />
          </label>

          <button
            type="submit"
            disabled={!avoiding.trim() || locked}
            className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#ff1a3c] via-[#ff2d55] to-[#ff4d6d] px-6 py-4 text-sm font-black uppercase tracking-[0.22em] text-white shadow-[0_0_36px_rgba(255,45,85,0.6)] transition active:scale-[0.98] disabled:opacity-45"
          >
            Lock it in
          </button>
        </form>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">
            Locked commitments
          </h2>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#ff2d55]/70">
            {hydrated ? `${openCount} open` : "…"}
          </span>
        </div>

        <ul className="mt-3 space-y-3 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {!hydrated ? (
            <li className="rounded-2xl border border-white/5 bg-black/40 px-4 py-5 text-sm text-zinc-500">
              Loading…
            </li>
          ) : tasks.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-[#ff2d55]/20 bg-black/40 px-4 py-8 text-center text-sm text-zinc-500">
              Nothing locked. Karen is watching the empty list with judgment.
            </li>
          ) : (
            tasks.map((row) => {
              const late = isPlannerTaskOverdue(row, nowMs);
              return (
                <li
                  key={row.id}
                  className={`rounded-2xl border px-4 py-4 ${
                    late
                      ? "border-[#ff2d55]/60 bg-rose-950/50 shadow-[0_0_28px_rgba(255,45,85,0.28)]"
                      : row.completed
                        ? "border-white/5 bg-black/30 opacity-55"
                        : "border-white/10 bg-black/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-semibold leading-snug ${
                          late
                            ? "text-[#ff2d55]"
                            : row.completed
                              ? "text-zinc-500 line-through"
                              : "text-white"
                        }`}
                      >
                        {row.task}
                      </p>
                      <p
                        className={`mt-1.5 text-[11px] uppercase tracking-[0.16em] ${
                          late ? "text-rose-300/90" : "text-zinc-500"
                        }`}
                      >
                        {late ? "Overdue · " : "Due · "}
                        {formatPlannerDeadline(row.deadline)}
                      </p>
                    </div>
                    {!row.completed ? (
                      <button
                        type="button"
                        onClick={() => {
                          updatePlannerTask(row.id, { completed: true });
                          setTasks(readPlannerTasks());
                        }}
                        className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 transition hover:border-emerald-400/40 hover:text-emerald-300"
                      >
                        Done
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTasks(removePlannerTask(row.id))}
                        className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600 hover:text-zinc-300"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {late ? (
                    <button
                      type="button"
                      onClick={() => onFaceConsequences(row)}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-[#ff2d55]/80 bg-[#ff2d55] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white shadow-[0_0_28px_rgba(255,45,85,0.55)] transition hover:bg-[#ff4d6d] active:scale-[0.98]"
                    >
                      Face the consequences
                    </button>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </div>

      <ProveYourWorthModal
        open={paywallOpen || locked}
        onClose={
          locked
            ? undefined
            : () => setPaywallOpen(false)
        }
      />
    </div>
  );
}
