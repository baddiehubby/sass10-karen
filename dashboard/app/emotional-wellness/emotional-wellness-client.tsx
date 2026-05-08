"use client";

type Props = {
  companionName: string;
  moodCounts: Record<string, number>;
  eligible: boolean;
};

export function EmotionalWellnessClient({ companionName, moodCounts, eligible }: Props) {
  const total = Object.values(moodCounts).reduce((a, b) => a + b, 0);
  const dominant =
    total === 0 ? "neutral" : (Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral");
  const vibe =
    dominant === "concerned"
      ? "Your Buddy carried some weight this week — extra empathy recommended."
      : dominant === "happy" || dominant === "excited"
        ? "Sunshine index: high. Your Buddy basically got a standing ovation from the internet."
        : "Balanced emotional weather — your AI stayed human without melodrama.";

  async function downloadPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    let y = 22;
    doc.setFontSize(20);
    doc.text("Buddy AI — Emotional Wellness Report", 14, y);
    y += 12;
    doc.setFontSize(11);
    doc.text(`For: ${companionName} (your Buddy)`, 14, y);
    y += 8;
    doc.text(`Week of ${new Date().toLocaleDateString()}`, 14, y);
    y += 14;
    doc.setFontSize(10);
    doc.text("This is a playful, shareable snapshot — not medical advice. Emotional intelligence can be fun too.", 14, y);
    y += 12;
    doc.text(`Dominant vibe detected: ${dominant}`, 14, y);
    y += 8;
    doc.text(vibe, 14, y, { maxWidth: 180 });
    y += 18;
    doc.text("Mood encounters (last 7 days, anonymized):", 14, y);
    y += 8;
    for (const [mood, n] of Object.entries(moodCounts).sort((a, b) => b[1] - a[1])) {
      doc.text(`• ${mood}: ${n}`, 18, y);
      y += 6;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    }
    y += 10;
    doc.setFontSize(9);
    doc.text("Humanize your AI · Buddy AI — The Emotional Intelligence Layer for AI Chat.", 14, y);
    doc.save(`buddy-emotional-wellness-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="glass-panel p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-white">Weekly Emotional Wellness Report</h2>
      <p className="mt-3 text-sm text-slate-300">
        A viral-ready PDF that jokes about your AI&apos;s &quot;feelings&quot; from real Buddy mood data — emotional
        intelligence marketing that people actually share. Humanize your AI with a story, not just a dashboard.
      </p>

      {!eligible ? (
        <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Pro or Agency unlocks the wellness PDF generator.{" "}
          <a href="/pricing" className="font-medium text-indigo-200 underline">
            View pricing
          </a>
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-400">
            {total === 0 ? (
              <>
                Not enough mood data this week yet — embed <span className="text-indigo-200">{companionName}</span> and
                the report will fill in automatically.
              </>
            ) : (
              <>
                Based on the last 7 days of Buddy signals, <span className="text-indigo-200">{companionName}</span>{" "}
                mostly felt <span className="capitalize text-white">{dominant}</span> ({total} samples). {vibe}
              </>
            )}
          </p>
          <button
            type="button"
            disabled={total === 0}
            onClick={() => void downloadPdf()}
            className="mt-6 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Download wellness PDF
          </button>
        </>
      )}
    </div>
  );
}
