"use client";

import { Chart, registerables } from "chart.js";
import { useEffect, useMemo, useRef } from "react";

Chart.register(...registerables);

const MOOD_SCORE: Record<string, number> = {
  happy: 0.9,
  excited: 0.95,
  neutral: 0.55,
  thinking: 0.5,
  sleepy: 0.35,
  concerned: 0.25,
  angry: 0.15,
};

type MoodSparklineProps = {
  events: Array<{ mood: string; timestamp: string }>;
};

export function MoodSparkline({ events }: MoodSparklineProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const { labels, data } = useMemo(() => {
    const days: string[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const buckets = new Map<string, { sum: number; n: number }>();
    for (const day of days) buckets.set(day, { sum: 0, n: 0 });

    for (const ev of events) {
      const day = ev.timestamp.slice(0, 10);
      if (!buckets.has(day)) continue;
      const score = MOOD_SCORE[ev.mood] ?? 0.5;
      const b = buckets.get(day)!;
      b.sum += score;
      b.n += 1;
    }

    return {
      labels: days.map((d) =>
        new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
      ),
      data: days.map((d) => {
        const b = buckets.get(d)!;
        return b.n ? Math.round((b.sum / b.n) * 100) : null;
      }),
    };
  }, [events]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    chartRef.current?.destroy();

    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Mood",
            data: data.map((v) => v ?? NaN),
            borderColor: "rgba(167, 139, 250, 0.7)",
            backgroundColor: "rgba(129, 140, 248, 0.08)",
            fill: true,
            tension: 0.45,
            spanGaps: true,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: {
            display: true,
            ticks: { color: "rgba(255,255,255,0.25)", font: { size: 10 } },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            display: false,
            min: 0,
            max: 100,
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [labels, data]);

  return (
    <div className="relative h-28 w-full max-w-lg">
      <canvas ref={ref} />
    </div>
  );
}
