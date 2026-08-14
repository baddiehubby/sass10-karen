"use client";

import type { MoodCheckIn } from "@/lib/companion-mood";

type MoodConstellationProps = {
  entries: MoodCheckIn[];
};

export function MoodConstellation({ entries }: MoodConstellationProps) {
  if (entries.length === 0) return null;
  const stars = entries.slice(0, 18);
  return (
    <div className="mood-sky" aria-hidden>
      {stars.map((row, i) => {
        const angle = (i / stars.length) * Math.PI * 1.7 + 0.4;
        const radius = 28 + (i % 5) * 12;
        const left = 50 + Math.cos(angle) * radius;
        const top = 50 + Math.sin(angle) * radius * 0.55;
        return (
          <span
            key={row.id}
            className={`mood-star mood-star-${row.mood}`}
            style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${i * 90}ms` }}
          />
        );
      })}
    </div>
  );
}
