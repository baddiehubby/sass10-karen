"use client";

import { useState } from "react";
import { MoodPicker } from "@/components/mood-picker";
import {
  PERSONALITY_CHOICES,
  type BuddyMood,
  type CompanionPersonality,
} from "@/lib/companion-mood";
import { markMeetComplete, savePersonality } from "@/lib/mood-memory";
import { recordBuddyCheckIn } from "@/lib/buddy-universe";

type BuddyMeetProps = {
  companionName: string;
  onDone: () => void;
};

export function BuddyMeet({ companionName, onDone }: BuddyMeetProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [vibe, setVibe] = useState<CompanionPersonality>("warm");

  function finish(mood?: BuddyMood) {
    savePersonality(vibe);
    if (mood) recordBuddyCheckIn(mood);
    markMeetComplete();
    onDone();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 px-4 pb-8 pt-16 backdrop-blur-sm md:items-center">
      <div
        role="dialog"
        aria-labelledby="meet-buddy-title"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0c1024]/95 p-6 text-center shadow-2xl"
      >
        {step === 0 ? (
          <>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Meet Buddy</p>
            <h2 id="meet-buddy-title" className="mt-3 text-2xl font-light text-white">
              {companionName} is here.
            </h2>
            <p className="mt-3 text-sm text-white/50">A companion for your mood, your moment.</p>
            <button
              type="button"
              className="mt-8 min-h-12 w-full rounded-full border border-white/20 bg-white/10 text-sm text-white"
              onClick={() => setStep(1)}
            >
              Continue
            </button>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2 id="meet-buddy-title" className="text-xl font-light text-white">
              What vibe are you?
            </h2>
            <div className="mt-5 grid grid-cols-1 gap-2">
              {PERSONALITY_CHOICES.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => setVibe(choice.id)}
                  className={`min-h-12 rounded-2xl border px-4 py-3 text-left ${
                    vibe === choice.id
                      ? "border-white/40 bg-white/10 text-white"
                      : "border-white/10 bg-white/5 text-white/70"
                  }`}
                >
                  <span className="block text-sm">{choice.label}</span>
                  <span className="text-xs text-white/40">{choice.hint}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-6 min-h-12 w-full rounded-full border border-white/20 bg-white/10 text-sm text-white"
              onClick={() => setStep(2)}
            >
              Next
            </button>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 id="meet-buddy-title" className="text-xl font-light text-white">
              How are you feeling right now?
            </h2>
            <p className="mt-2 text-sm text-white/40">One tap. You can skip.</p>
            <div className="mt-6">
              <MoodPicker onSelect={(mood) => finish(mood)} />
            </div>
            <button type="button" className="mt-6 text-xs text-white/35 hover:text-white/60" onClick={() => finish()}>
              Skip for now
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
