"use client";

/**
 * Premium consumer onboarding — companion, not developer setup.
 * Orb first; intelligence warms in the background. Never show plumbing.
 */

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { BuddyOrb } from "@/components/buddy-orb";
import {
  PERSONALITY_CHOICES,
  type BuddyMood,
  type CompanionPersonality,
} from "@/lib/companion-mood";
import { markMeetComplete, savePersonality } from "@/lib/mood-memory";
import { recordBuddyCheckIn } from "@/lib/buddy-universe";

type Step = "orb" | "intro" | "prefs" | "touch";

const INTRO_LINES = [
  "I'm Buddie — a companion who stays with your mood.",
  "I'm here for how you feel — nothing to set up.",
  "Just presence.",
];

const SAVE_SOFT_ERROR = "Couldn't save that — try again in a moment.";

export function BuddieOnboardingExperience({
  defaultName = "Buddie",
  alreadyComplete = false,
}: {
  defaultName?: string;
  alreadyComplete?: boolean;
}) {
  const router = useRouter();
  const { update } = useSession();
  const [step, setStep] = useState<Step>("orb");
  const [name, setName] = useState(defaultName);
  const [vibe, setVibe] = useState<CompanionPersonality>("warm");
  const [lineIdx, setLineIdx] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [orbMood, setOrbMood] = useState<BuddyMood>("curious");

  useEffect(() => {
    if (alreadyComplete) {
      router.replace("/dashboard");
    }
  }, [alreadyComplete, router]);

  useEffect(() => {
    if (step !== "orb") return;
    const t = window.setTimeout(() => setStep("intro"), 900);
    return () => window.clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (step !== "intro") return;
    if (lineIdx >= INTRO_LINES.length - 1) return;
    const t = window.setTimeout(() => setLineIdx((i) => i + 1), 1600);
    return () => window.clearTimeout(t);
  }, [step, lineIdx]);

  async function completeAndEnter(mood?: BuddyMood) {
    setError(null);
    const companionName = name.trim() || "Buddie";
    savePersonality(vibe);
    if (mood) {
      recordBuddyCheckIn(mood);
      setOrbMood(mood);
    }
    markMeetComplete();

    startTransition(async () => {
      try {
        const res = await fetch("/api/onboarding/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companionName, personality: vibe }),
        });
        if (!res.ok) {
          // Never surface server/API wording to the user
          setError(SAVE_SOFT_ERROR);
          return;
        }
        await update();
        router.replace("/dashboard");
        router.refresh();
      } catch {
        setError(SAVE_SOFT_ERROR);
      }
    });
  }

  return (
    <div className="buddie-home relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 buddie-aurora" aria-hidden />

      <p className="buddie-brand relative z-10 mb-6 text-4xl tracking-tight text-[#f4efe6] md:text-5xl">
        Buddie
      </p>

      <div className="relative z-10 transition-transform duration-700" style={{ transform: step === "orb" ? "scale(1.05)" : "scale(1)" }}>
        <BuddyOrb
          mood={orbMood}
          size={step === "touch" ? 200 : 240}
          interactive={step === "touch"}
          onActivate={() => {
            if (step === "touch") void completeAndEnter("curious");
          }}
          label="Buddie"
          animation="soft"
        />
      </div>

      {step === "orb" ? (
        <p className="relative z-10 mt-10 text-sm text-white/45">Arriving…</p>
      ) : null}

      {step === "intro" ? (
        <div className="relative z-10 mt-10 max-w-md space-y-4">
          <p className="buddie-display text-2xl text-[#f4efe6] md:text-3xl">{INTRO_LINES[lineIdx]}</p>
          {lineIdx >= INTRO_LINES.length - 1 ? (
            <button
              type="button"
              className="buddie-cta mt-6 min-h-12 px-8"
              onClick={() => setStep("prefs")}
            >
              Meet you
            </button>
          ) : null}
        </div>
      ) : null}

      {step === "prefs" ? (
        <div className="relative z-10 mt-8 w-full max-w-md space-y-8 text-left">
          <div>
            <label htmlFor="buddie-name" className="text-xs uppercase tracking-[0.22em] text-white/35">
              What should I call you?
            </label>
            <input
              id="buddie-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="mt-3 w-full border-0 border-b border-white/20 bg-transparent pb-2 text-xl text-[#f4efe6] outline-none placeholder:text-white/25 focus:border-white/45"
              placeholder="Your name"
              autoComplete="nickname"
            />
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/35">Companion vibe</p>
            <div className="mt-4 flex flex-col gap-2">
              {PERSONALITY_CHOICES.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => setVibe(choice.id)}
                  className={`min-h-12 rounded-none border-0 border-l-2 px-4 py-3 text-left transition ${
                    vibe === choice.id
                      ? "border-[#e8c4a0] bg-white/5 text-[#f4efe6]"
                      : "border-transparent text-white/55 hover:text-white/80"
                  }`}
                >
                  <span className="block text-sm">{choice.label}</span>
                  <span className="text-xs text-white/35">{choice.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <button type="button" className="buddie-cta w-full min-h-12" onClick={() => setStep("touch")}>
            Continue
          </button>
        </div>
      ) : null}

      {step === "touch" ? (
        <div className="relative z-10 mt-10 max-w-sm space-y-5">
          <p className="buddie-display text-2xl text-[#f4efe6]">Tap the orb — first spark.</p>
          <p className="text-sm text-white/45">
            That&apos;s enough to begin. Everything else unfolds gently.
          </p>
          <button
            type="button"
            className="text-xs text-white/35 underline-offset-4 hover:text-white/60 hover:underline"
            disabled={pending}
            onClick={() => void completeAndEnter()}
          >
            {pending ? "Opening home…" : "Skip touch · enter home"}
          </button>
          {error ? <p className="text-sm text-[#e8c4a0]/90">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
