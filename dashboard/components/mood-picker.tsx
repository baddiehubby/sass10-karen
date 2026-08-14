"use client";

import { CHECKIN_CHOICES, type BuddyMood } from "@/lib/companion-mood";

type MoodPickerProps = {
  onSelect: (mood: BuddyMood) => void;
  selected?: BuddyMood | null;
};

export function MoodPicker({ onSelect, selected }: MoodPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-2" role="listbox" aria-label="How are you feeling?">
      {CHECKIN_CHOICES.map((choice) => {
        const active = selected === choice.mood;
        return (
          <button
            key={choice.mood}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onSelect(choice.mood)}
            className={`min-h-12 rounded-2xl border px-2 py-3 text-sm transition ${
              active
                ? "border-white/40 bg-white/12 text-white"
                : "border-white/10 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/8"
            }`}
          >
            <span className="block text-lg" aria-hidden>
              {choice.emoji}
            </span>
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
