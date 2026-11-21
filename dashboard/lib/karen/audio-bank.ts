/**
 * Pre-generated Karen Audio Bank — premium MP3s under `/public/audio/`.
 * Zero latency for catalog lines; speechSynthesis only for dynamic inserts.
 */

import { QUESTIONS } from "@/lib/karen/game-engine";
import { ANSWER_ROASTS, VERDICT_LIBRARY } from "@/lib/karen/roasts";
import { PROUD_RESPONSES } from "@/lib/karen/good-streak";
import { CHECKIN_NO_LINE, CHECKIN_YES_LINE } from "@/lib/karen/accountability";
import { MORNING_ROAST_LINE } from "@/lib/karen/morning-roast";
import { AFTERNOON_NUDGE_SPEECH } from "@/lib/karen/afternoon-nudge";
import {
  FORGIVE_LINE,
  FORGIVE_SRC,
  RARE_ROAST_LINE,
  RARE_ROAST_SRC,
} from "@/lib/karen/state";
import {
  SMACKBACK_CLIPS,
  VOLUME_INTERRUPT_AUDIO_ID,
  VOLUME_INTERRUPT_LINE,
  VOLUME_INTERRUPT_SRC,
} from "@/lib/karen/smack-back";
import comebacksDb from "@/lib/karen/comebacks.json";
import {
  DONE_LISTENING_AUDIO_ID,
  DONE_LISTENING_LINE,
  DONE_LISTENING_SRC,
} from "@/lib/karen/state";

export type AudioBankEntry = {
  id: string;
  text: string;
  /** Path under /public, e.g. /audio/bank/q1_gym.mp3 */
  src: string;
  kind: "question" | "roast" | "verdict" | "reaction" | "checkin" | "system" | "smackback";
};

export type DynamicInserts = Record<string, string>;

const OPTION_IDS = ["a", "b", "c"] as const;

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

function bankPath(folder: string, name: string): string {
  return `/audio/bank/${folder}/${name}.mp3`;
}

/** Build the canonical catalog (~100+ lines) mapped to assumed premium MP3s. */
function buildCatalog(): AudioBankEntry[] {
  const entries: AudioBankEntry[] = [];

  // Questions (free roast bank — currently 9)
  for (const q of QUESTIONS) {
    entries.push({
      id: `question:${q.id}`,
      text: q.text,
      src: bankPath("questions", q.id),
      kind: "question",
    });
  }

  // Answer roasts (questions × 3 × lines)
  for (const [qid, byAnswer] of Object.entries(ANSWER_ROASTS)) {
    for (const aid of OPTION_IDS) {
      const lines = byAnswer[aid] ?? [];
      lines.forEach((text, i) => {
        entries.push({
          id: `roast:${qid}:${aid}:${i}`,
          text,
          src: bankPath("roasts", `${qid}_${aid}_${i}`),
          kind: "roast",
        });
      });
    }
  }

  // Verdict titles + roasts (3 traits × 3 tiers × 2 = 18)
  for (const trait of Object.keys(VERDICT_LIBRARY) as Array<keyof typeof VERDICT_LIBRARY>) {
    const pack = VERDICT_LIBRARY[trait];
    const pairs: Array<[string, string]> = [
      ["title", pack.title],
      ["roast", pack.roast],
      ["mid_title", pack.midTitle],
      ["mid_roast", pack.midRoast],
      ["low_title", pack.lowTitle],
      ["low_roast", pack.lowRoast],
    ];
    for (const [key, text] of pairs) {
      entries.push({
        id: `verdict:${trait}:${key}`,
        text,
        src: bankPath("verdicts", `${trait}_${key}`),
        kind: "verdict",
      });
    }
  }

  // Proud / praise (5)
  PROUD_RESPONSES.forEach((text, i) => {
    entries.push({
      id: `proud:${i}`,
      text,
      src: bankPath("proud", `proud_${String(i + 1).padStart(2, "0")}`),
      kind: "reaction",
    });
  });

  // Check-in + system
  entries.push(
    {
      id: "checkin:yes",
      text: CHECKIN_YES_LINE,
      src: bankPath("checkin", "yes"),
      kind: "checkin",
    },
    {
      id: "checkin:no",
      text: CHECKIN_NO_LINE,
      src: bankPath("checkin", "no"),
      kind: "checkin",
    },
    {
      id: "system:morning",
      text: MORNING_ROAST_LINE,
      src: bankPath("system", "morning_roast"),
      kind: "system",
    },
    {
      id: "system:afternoon",
      text: AFTERNOON_NUDGE_SPEECH,
      src: bankPath("system", "afternoon_nudge"),
      kind: "system",
    },
    {
      id: "rare:roast",
      text: RARE_ROAST_LINE,
      src: RARE_ROAST_SRC,
      kind: "reaction",
    },
    {
      id: "reaction:forgive",
      text: FORGIVE_LINE,
      src: FORGIVE_SRC,
      kind: "reaction",
    },
  );

  // Extra reaction bank to push catalog toward ~100 premium lines
  const EXTRA_REACTIONS = [
    "Noted. Disappointing, but noted.",
    "Wow. Bold choice for someone this fragile.",
    "Say that louder for the people in the back — of your excuses.",
    "I expected nothing and somehow still lost.",
    "That answer aged like milk in a hot car.",
    "You're not complex. You're inconsistent.",
    "Keep talking. I'm building your case file.",
    "Confidence without evidence. My favorite genre of failure.",
    "If mediocrity were a sport, you'd medal.",
    "That was a confession disguised as a flex.",
    "You outsourced discipline to vibes. Vibes bounced.",
    "Fascinating. Wrong, but fascinating.",
    "I've heard better excuses from houseplants.",
    "Your potential just filed a missing person report.",
    "Stop narrating. Start doing.",
    "That energy is why nothing ships.",
    "You're allergic to follow-through.",
    "Cute story. Still didn't do the thing.",
    "The bar was on the floor. You brought a shovel.",
    "I believe in you the way I believe in unicorns.",
    "Delete that sentence from your personality.",
    "You're performing effort, not producing it.",
    "This is why we can't have accountability.",
    "Your future self is already mad.",
    "Congratulations on inventing a new way to stall.",
    "I've seen stronger commitments on sticky notes.",
    "That wasn't a plan. That was a vibe with anxiety.",
    "You don't need motivation. You need consequences.",
    "I'm not angry. I'm documenting.",
    "If excuses burned calories, you'd be shredded.",
    "You skipped {{goal}}. Of course you did.",
    "Tell {{name}} I'm disappointed in them by association.",
    "{{name}} — pay attention. This part is about you.",
    "You said you'd crush {{goal}}. Then you crushed your standards instead.",
  ];

  EXTRA_REACTIONS.forEach((text, i) => {
    entries.push({
      id: `reaction:${i}`,
      text,
      src: bankPath("reactions", `rx_${String(i + 1).padStart(2, "0")}`),
      kind: "reaction",
    });
  });

  // Combat smackbacks — 50 mapped clips + volume interrupt + dominance fallbacks
  entries.push({
    id: VOLUME_INTERRUPT_AUDIO_ID,
    text: VOLUME_INTERRUPT_LINE,
    src: VOLUME_INTERRUPT_SRC,
    kind: "smackback",
  });
  for (const clip of SMACKBACK_CLIPS) {
    entries.push({
      id: `smackback:${clip.id}`,
      text: clip.text,
      src: clip.src,
      kind: "smackback",
    });
  }
  for (const dom of comebacksDb.dominanceFallbacks) {
    entries.push({
      id: dom.audioId,
      text: dom.text,
      src: dom.src,
      kind: "smackback",
    });
  }
  entries.push({
    id: DONE_LISTENING_AUDIO_ID,
    text: DONE_LISTENING_LINE,
    src: DONE_LISTENING_SRC,
    kind: "smackback",
  });

  return entries;
}

export const AUDIO_BANK: readonly AudioBankEntry[] = buildCatalog();

const byId = new Map(AUDIO_BANK.map((e) => [e.id, e]));
const byNormalizedText = new Map(
  AUDIO_BANK.map((e) => [normalizeLine(e.text), e] as const),
);

export function normalizeLine(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function getAudioBankSize(): number {
  return AUDIO_BANK.length;
}

export function lookupAudioById(id: string): AudioBankEntry | null {
  return byId.get(id) ?? null;
}

export function lookupAudioByText(text: string): AudioBankEntry | null {
  return byNormalizedText.get(normalizeLine(text)) ?? null;
}

/** Map mid-quiz roast text → bank entry (handles multi-line pools). */
export function lookupRoastClip(
  questionId: string,
  answerId: string,
  text: string,
): AudioBankEntry | null {
  const pool = ANSWER_ROASTS[questionId]?.[answerId] ?? [];
  const idx = pool.findIndex((line) => normalizeLine(line) === normalizeLine(text));
  if (idx >= 0) {
    return lookupAudioById(`roast:${questionId}:${answerId}:${idx}`);
  }
  return lookupAudioByText(text);
}

export function lookupQuestionClip(questionId: string): AudioBankEntry | null {
  return lookupAudioById(`question:${questionId}`);
}

/**
 * Templates may include `{{name}}` / `{{goal}}`.
 * Returns whether the spoken line needs dynamic TTS (unique inserts).
 */
export function applyDynamicInserts(
  template: string,
  inserts?: DynamicInserts | null,
): { text: string; needsTts: boolean } {
  if (!inserts || !Object.keys(inserts).length) {
    return { text: template, needsTts: /\{\{[a-z_]+\}\}/i.test(template) };
  }
  let text = template;
  let usedDynamic = false;
  for (const [key, value] of Object.entries(inserts)) {
    const token = `{{${key}}}`;
    if (text.includes(token)) {
      const clean = value.replace(/\s+/g, " ").trim();
      text = text.split(token).join(clean || key);
      if (clean) usedDynamic = true;
    }
  }
  // Unreplaced tokens → still treat as dynamic / incomplete bank line.
  const leftover = /\{\{[a-z_]+\}\}/i.test(text);
  return { text: text.replace(/\s+/g, " ").trim(), needsTts: usedDynamic || leftover };
}

export type ResolveSpeechResult = {
  /** Final spoken string (after inserts). */
  text: string;
  /** Premium MP3 when available and not dynamic. */
  src: string | null;
  /** Use speechSynthesis for unique inserts / missing files. */
  useTts: boolean;
  entry: AudioBankEntry | null;
};

/**
 * Resolve what to play for a Karen line.
 * Prefers bank MP3; forces TTS when dynamic inserts make the line unique.
 */
export function resolveKarenSpeech(opts: {
  text: string;
  audioId?: string | null;
  questionId?: string | null;
  answerId?: string | null;
  dynamic?: DynamicInserts | null;
}): ResolveSpeechResult {
  const baseEntry =
    (opts.audioId ? lookupAudioById(opts.audioId) : null) ||
    (opts.questionId && opts.answerId
      ? lookupRoastClip(opts.questionId, opts.answerId, opts.text)
      : null) ||
    (opts.questionId && !opts.answerId ? lookupQuestionClip(opts.questionId) : null) ||
    lookupAudioByText(opts.text);

  const template = baseEntry?.text ?? opts.text;
  const { text, needsTts } = applyDynamicInserts(template, opts.dynamic);

  if (needsTts) {
    return { text, src: null, useTts: true, entry: baseEntry };
  }

  return {
    text,
    src: baseEntry?.src ?? null,
    useTts: !baseEntry,
    entry: baseEntry,
  };
}

/** Dev helper — list expected MP3 paths for the voice production pipeline. */
export function listExpectedAudioPaths(): string[] {
  return AUDIO_BANK.map((e) => e.src);
}

export function audioBankStats(): { total: number; byKind: Record<string, number> } {
  const byKind: Record<string, number> = {};
  for (const e of AUDIO_BANK) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  }
  return { total: AUDIO_BANK.length, byKind };
}

/** @internal test helper */
export function _slugForTest(s: string): string {
  return slug(s);
}
