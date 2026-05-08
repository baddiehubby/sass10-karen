"use client";

import { Chart, registerables } from "chart.js";
import { useEffect, useMemo, useRef } from "react";

Chart.register(...registerables);

export function MoodTimelineLineChart(props: { timestamps: string[] }) {
  const { timestamps } = props;
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const { labels, data } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ts of timestamps) {
      const dk = ts.slice(0, 10);
      counts.set(dk, (counts.get(dk) || 0) + 1);
    }
    const sorted = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
    return {
      labels: sorted.map(([d]) => d),
      data: sorted.map(([, n]) => n),
    };
  }, [timestamps]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    chartRef.current?.destroy();

    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels.length ? labels : ["—"],
        datasets: [
          {
            label: "Mood events / day",
            data: data.length ? data : [0],
            borderColor: "#818cf8",
            backgroundColor: "rgba(129, 140, 248, 0.15)",
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            ticks: { color: "#94a3b8", maxRotation: 45, minRotation: 0, font: { size: 10 } },
            grid: { color: "rgba(148,163,184,0.12)" },
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#94a3b8", precision: 0 },
            grid: { color: "rgba(148,163,184,0.12)" },
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
    <div className="relative h-48 w-full">
      <canvas ref={ref} className="max-h-48 w-full" />
    </div>
  );
}
