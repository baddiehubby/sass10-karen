export type ChallengeReportInput = {
  companionName: string;
  moodCounts: Record<string, number>;
  /** Dominant mood label for share line */
  headlineMood: string;
  horoscope: string;
  buddyAdvice: string;
  grade: string;
};

function dominantMood(counts: Record<string, number>): string {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (!entries.length) return "mysteriously calm";
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function horoscopeFor(mood: string): string {
  const m: Record<string, string> = {
    happy: "The stars align with your changelog: Jupiter is in retrograde, but your deploy went green anyway.",
    excited: "Mercury dares you to ship on a Friday. The cosmos applauds your chaos.",
    neutral: "The moon is in spreadsheet. Expect mild productivity and one unnecessary meeting.",
    thinking: "Saturn asks hard questions. Your AI read three docs and still pretends it understood.",
    concerned: "Mars enters your support queue. Hydrate, mute Slack, and blame DNS.",
    sleepy: "Neptune yawns. Your model should nap — you definitely should.",
  };
  return m[mood] || m.neutral;
}

function adviceFor(mood: string): string {
  const m: Record<string, string> = {
    happy: "Celebrate small wins publicly. Your users can smell sincerity (and good metrics).",
    excited: "Channel hype into onboarding. Excitement without clarity becomes churn.",
    neutral: "Add one human sentence per AI reply. Neutrality is a feature until it feels like a fridge.",
    thinking: "Show your work: citations build trust faster than confidence scores.",
    concerned: "Trigger proactive help before the third sigh-equivalent message.",
    sleepy: "Respect quiet hours. Even Buddies dream of lower token bills.",
  };
  return m[mood] || m.neutral;
}

function gradeLetter(total: number, concerned: number): string {
  if (total === 0) return "Incomplete (adorably)";
  const ratio = concerned / total;
  if (ratio < 0.08) return "A+ (Suspiciously well-adjusted)";
  if (ratio < 0.15) return "B (Healthy angst)";
  if (ratio < 0.25) return "C (Spicy but shippable)";
  return "D+ (Your AI needs a vacation)";
}

export function buildChallengeReportPayload(moodCounts: Record<string, number>, companionName: string): ChallengeReportInput {
  const total = Object.values(moodCounts).reduce((a, b) => a + b, 0);
  const dom = dominantMood(moodCounts);
  const concerned = moodCounts.concerned || 0;
  return {
    companionName,
    moodCounts,
    headlineMood: dom,
    horoscope: horoscopeFor(dom),
    buddyAdvice: adviceFor(dom),
    grade: gradeLetter(total, concerned),
  };
}

export async function renderChallengeReportPdf(data: ChallengeReportInput): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;

  const setBrandHeader = (d: typeof doc) => {
    d.setFillColor(79, 70, 229);
    d.rect(0, 0, 210, 36, "F");
    d.setTextColor(255, 255, 255);
    d.setFontSize(20);
    d.text("Buddy AI Challenge Report", 14, 22);
    d.setFontSize(10);
    d.text("Emotional Intelligence · Not a medical device · Definitely shareable", 14, 30);
    d.setTextColor(30, 41, 59);
  };

  setBrandHeader(doc);
  y = 46;
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229);
  doc.text(`Companion: ${data.companionName}`, 14, y);
  y += 10;
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(`Report card grade: ${data.grade}`, 14, y);
  y += 8;
  doc.text(`Dominant vibe: ${data.headlineMood}`, 14, y);
  y += 12;

  doc.setFillColor(224, 231, 255);
  doc.roundedRect(14, y - 4, 182, 28, 3, 3, "F");
  doc.setTextColor(30, 27, 75);
  doc.setFontSize(12);
  doc.text("AI horoscope", 18, y + 4);
  doc.setFontSize(10);
  const horLines = doc.splitTextToSize(data.horoscope, 170);
  doc.text(horLines, 18, y + 10);
  y += 34;

  doc.setFillColor(254, 243, 199);
  doc.roundedRect(14, y - 4, 182, 28, 3, 3, "F");
  doc.setTextColor(120, 53, 15);
  doc.setFontSize(12);
  doc.text("Buddy's advice", 18, y + 4);
  doc.setFontSize(10);
  const advLines = doc.splitTextToSize(data.buddyAdvice, 170);
  doc.text(advLines, 18, y + 10);
  y += 36;

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(12);
  doc.text("Mood mix (sample window)", 14, y);
  y += 8;
  doc.setFontSize(10);
  for (const [k, v] of Object.entries(data.moodCounts).sort((a, b) => b[1] - a[1])) {
    doc.text(`• ${k}: ${v}`, 18, y);
    y += 6;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Buddy AI — The Emotional Intelligence Layer for AI Chat.", 14, y);

  return Buffer.from(doc.output("arraybuffer"));
}
