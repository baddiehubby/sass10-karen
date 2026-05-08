"use client";

import { Chart, registerables } from "chart.js";
import { useEffect, useRef } from "react";

Chart.register(...registerables);

const INDUSTRIES = ["Retail", "SaaS", "Healthcare", "Finance", "Education"] as const;
const MOODS = ["Neutral", "Happy", "Frustrated", "Excited", "Thinking"] as const;

/** Fake global percentages per industry (authority / SEO page). */
const DATA: Record<(typeof INDUSTRIES)[number], number[]> = {
  Retail: [45, 30, 12, 8, 5],
  SaaS: [38, 28, 18, 10, 6],
  Healthcare: [52, 22, 10, 9, 7],
  Finance: [48, 20, 15, 10, 7],
  Education: [41, 33, 9, 12, 5],
};

export function StateOfEmotionsChart() {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    chartRef.current?.destroy();

    const labels = [...INDUSTRIES];
    const datasets = MOODS.map((mood, i) => ({
      label: mood,
      data: labels.map((ind) => DATA[ind][i]),
      backgroundColor: ["#94a3b8", "#22c55e", "#ef4444", "#a855f7", "#f59e0b"][i],
      borderRadius: 4,
    }));

    chartRef.current = new Chart(canvas, {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#cbd5e1", boxWidth: 12 },
          },
          title: {
            display: true,
            text: "Reported emotional tone by industry (mock study)",
            color: "#e2e8f0",
            font: { size: 14 },
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: "#94a3b8" },
            grid: { color: "rgba(148,163,184,0.12)" },
          },
          y: {
            stacked: true,
            max: 100,
            ticks: { color: "#94a3b8", callback: (v) => `${v}%` },
            grid: { color: "rgba(148,163,184,0.12)" },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-80 w-full">
      <canvas ref={ref} />
    </div>
  );
}
