/**
 * "Smack Back" — local scream → keyword match → pre-recorded counterpunch.
 * Deterministic, zero LLM. Instant psychological combat.
 *
 * Content policy (Google Play): every roast line targets the user's *actions*
 * (laziness, excuses, volume, cowardice) — never protected classes, identity,
 * or hate speech. See `isActionBasedRoastText` / `assertSmackBackPolicySafe`.
 *
 * Audio paths come from `data/audio-manifest.json`.
 * Playback: fetch MP3/WAV → AudioContext.decodeAudioData → talkingHead.speakAudio.
 */

import audioManifest from "@/data/audio-manifest.json";
import {
  getKeywordPool,
  keywordFilePool,
  listCategoryClips,
  pickCategoryClip,
  pickFreshWav,
  textForAudioFile,
} from "@/lib/karen/audio-router";
import comebacksDb from "@/lib/karen/comebacks.json";
import type { TalkingHeadLike } from "@/lib/karen/expression-bridge";
import {
  KAREN_RAGE_QUIET_THRESHOLD,
  KAREN_RAGE_SCREAM_THRESHOLD,
  type KarenMoodMode,
} from "@/lib/karen/game-engine";
import { WIN_KO_LINE, WIN_KO_SRC } from "@/lib/karen/game-state";

export const SMACK_BACK_COOLDOWN_MS = 10_000;
export const SMACK_BACK_CHAOS_DELTA = 5;
/**
 * Mic “about to attack” flash — keep ≤100ms so cached WAV playback feels instant.
 * (Was 500ms; that fought the zero-latency cache.)
 */
export const SMACK_BACK_PROCESS_MS = 100;
/** Respect hit every time the user screams / argues. */
export const SCREAM_RESPECT_DELTA = -5;

export const VOLUME_INTERRUPT_LINE =
  "DON'T YOU DARE RAISE YOUR VOICE AT ME!";
export const VOLUME_INTERRUPT_AUDIO_ID = "smackback:volume_interrupt";

/** Loudness threshold (0–255 analyser average). */
export const SCREAM_VOLUME_THRESHOLD = 48;

type ManifestClip = {
  file: string;
  alias?: string;
  text: string;
  readyFallback?: string;
};

type AudioManifest = {
  version: number;
  basePath: string;
  /** Keyword → one or many relative WAV paths (random + no-repeat). */
  keywords: Record<string, string | string[]>;
  clips: Record<string, ManifestClip>;
  interrupts: Record<string, ManifestClip>;
  fallbacks: Record<string, ManifestClip>;
  garbage: string[];
};

const MANIFEST = audioManifest as AudioManifest;

export type SmackBackClip = {
  id: string;
  text: string;
  src: string;
};

type ComebackEntry = {
  id: string;
  keywords: string[];
  text: string;
  src: string;
  clipId: string;
};

type DominanceFallback = {
  id: string;
  text: string;
  src: string;
  audioId: string;
};

type ComebacksDb = {
  garbage: string[];
  dominanceFallbacks: DominanceFallback[];
  entries: ComebackEntry[];
};

const DB = comebacksDb as ComebacksDb;

/** Absolute public URL for a manifest-relative file. */
export function audioPublicUrl(rel: string): string {
  if (!rel) return "";
  if (rel.startsWith("/")) return rel;
  if (rel.startsWith("http")) return rel;
  const base = MANIFEST.basePath.replace(/\/$/, "");
  return `${base}/${rel.replace(/^\//, "")}`;
}

/**
 * Normalize Voicemaker names (`smack_01.mp3`) ↔ catalog ids (`sb_01.mp3`)
 * and prefer ready Maya WAVs when listed as readyFallback.
 */
export function resolveSmackbackSrc(fileOrUrl: string): string {
  const raw = (fileOrUrl || "").trim();
  if (!raw) return "";

  // Already absolute public path
  let rel = raw.startsWith("/audio/")
    ? raw.slice("/audio/".length)
    : raw.replace(/^\//, "");

  // Alias: smack_12.mp3 → smackbacks/sb_12.mp3
  const smackAlias = rel.match(/^(?:smackbacks\/)?smack_(\d+)\.(mp3|wav)$/i);
  if (smackAlias) {
    const n = smackAlias[1]!.padStart(2, "0");
    const clip = MANIFEST.clips[`sb_${n}`];
    if (clip?.readyFallback) return audioPublicUrl(clip.readyFallback);
    rel = clip?.file || `smackbacks/sb_${n}.mp3`;
  }

  // Catalog clip — prefer Kokoro .wav takes over stub MP3s
  const sb = rel.match(/(?:^|\/)sb_(\d+)\.(mp3|wav)$/i);
  if (sb) {
    const id = `sb_${sb[1]!.padStart(2, "0")}`;
    const clip = MANIFEST.clips[id];
    if (clip?.file?.endsWith(".wav")) return audioPublicUrl(clip.file);
    if (clip?.readyFallback) return audioPublicUrl(clip.readyFallback);
    // Default to Kokoro WAV even if manifest still lists .mp3
    return audioPublicUrl(`smackbacks/${id}.wav`);
  }

  // Interrupt / fallback ready paths (legacy map + category pool)
  for (const clip of Object.values(MANIFEST.interrupts || {})) {
    if (rel.endsWith(clip.file.split("/").pop() || "")) {
      return audioPublicUrl(clip.readyFallback || clip.file);
    }
  }
  for (const clip of listCategoryClips("interrupts")) {
    if (rel.endsWith(clip.file.split("/").pop() || "")) {
      return audioPublicUrl(clip.file);
    }
  }
  for (const clip of Object.values(MANIFEST.fallbacks)) {
    if (
      rel.endsWith(clip.file.split("/").pop() || "") ||
      (clip.alias && rel.endsWith(clip.alias.split("/").pop() || ""))
    ) {
      return audioPublicUrl(clip.file);
    }
  }

  return audioPublicUrl(rel);
}

export const VOLUME_INTERRUPT_SRC = resolveSmackbackSrc(
  MANIFEST.interrupts.volume?.file || "smackbacks/volume_interrupt.mp3",
);

/**
 * 50 aggressive smackback lines mapped via audio-manifest.
 */
export const SMACKBACK_CLIPS: readonly SmackBackClip[] = Object.entries(
  MANIFEST.clips,
)
  .filter(([id]) => /^sb_\d+$/.test(id))
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([id, clip]) => ({
    id,
    text: clip.text,
    src: resolveSmackbackSrc(clip.file),
  }));

export type SmackBackMood = "FURIOUS" | "DEFEATED";

export type SmackBackResult = {
  text: string;
  mood: SmackBackMood;
  chaosDelta: number;
  respectDelta: number;
  audioId: string;
  /** Public URL ready for playWavAudio / speakLocalRoast. */
  src: string;
  /** True when volume interrupt fired mid-scream. */
  volumeInterrupt?: boolean;
  /** Keywords that scored the match (debug / HUD). */
  matchedKeywords?: string[];
  /** True when dominance fallback fired (garbage / no keyword hit). */
  dominanceFallback?: boolean;
  /** Profanity mute protocol — disable mic until apology. */
  muteProtocol?: boolean;
  /** Logical argument → petty gaslight deflection (never a reasoned reply). */
  gaslight?: boolean;
  /** Rage > 80 — ignore keywords, scream, refuse the mic. */
  screamingRage?: boolean;
  /** Rage < 20 — dangerously quiet; mic locks. */
  quietRage?: boolean;
  /** Exact same line twice → broken record + Mute Protocol. */
  brokenRecord?: boolean;
  /** 10% dopamine hit — user "wins" the round; unlock Share Victory. */
  userWon?: boolean;
};

/** Random chance a mic line triggers the WIN / DEFEATED dopamine hit. */
export const WIN_CHANCE = 0.1;

/** Same line as patience-zero KO win — keep smack-back + fight state in sync. */
export const WIN_LINE = WIN_KO_LINE;
export const WIN_SRC = WIN_KO_SRC;
export const WIN_AUDIO_ID = "smackback:win_round";

/** Rage-scream clips — ignore whatever they said. */
export const SCREAMING_RAGE_LINES: readonly {
  text: string;
  audioId: string;
  src: string;
}[] = [
  {
    text: "AAAAHHH — DON'T YOU DARE RAISE YOUR VOICE AT ME!",
    audioId: "smackback:scream_01",
    src: "smackbacks/volume_interrupt.wav",
  },
  {
    text: "I DON'T HAVE ALL DAY FOR YOUR NOISE!",
    audioId: "smackback:scream_02",
    src: "smackbacks/sb_11.wav",
  },
  {
    text: "SHUT UP. I'M SCREAMING NOW.",
    audioId: "smackback:scream_03",
    src: "smackbacks/dominance_02.wav",
  },
];

export const QUIET_RAGE_LINE = "Fine. I'm done talking.";
export const QUIET_RAGE_AUDIO_ID = "smackback:quiet_rage";
export const QUIET_RAGE_SRC = "smackbacks/done_listening.wav";
/** Quiet spell — mic lock duration. */
export const QUIET_RAGE_LOCK_MS = 12_000;

export const BROKEN_RECORD_LINE = "You are a broken record";
export const BROKEN_RECORD_AUDIO_ID = "smackback:broken_record";
export const BROKEN_RECORD_SRC = "smackbacks/sb_05.wav";

/** Mute protocol clip (Kokoro). */
export const MUTE_LINE =
  "Watch your mouth. Mic's off until you apologize.";
export const MUTE_AUDIO_ID = "smackback:mute";
export const MUTE_SRC = "/audio/mute/mute.wav";
export const MUTE_APOLOGY_PROMPT = "Apologize. Then maybe I'll listen again.";

/**
 * ENTER THE ROAST opener — max aggression from second zero.
 * WAV is cache-hot (priority preload); line is the lipsync / HUD copy.
 */
export const OPENING_ROAST_LINE =
  "I've been waiting for you to grow a spine. Let's go.";
export const OPENING_ROAST_AUDIO_ID = "smackback:opening";
export const OPENING_ROAST_SRC = "/audio/smackbacks/dominance_02.wav";

/** Typo / gibberish / short-sentence disrespect lines (behavior-only). */
export const TYPO_DISRESPECT_LINES = [
  "Did you just have a stroke? Speak English.",
  "I don't speak coward.",
  "Massive L. You can't even type.",
] as const;

/** Word-boundary profanity filter — triggers Mute Protocol. */
const PROFANITY: readonly string[] = [
  "fuck",
  "fucking",
  "fucker",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "dick",
  "cunt",
  "motherfucker",
  "mf",
  "wtf",
];

/**
 * Hard blocklist for roast *output* — slurs + protected-class / identity attacks.
 * Roasts must stay on behavior (excuses, laziness, volume, quitting).
 * Kept deliberately broad; word-boundary matched so "blackout" / "history" stay OK.
 */
const PROTECTED_OR_HATE: readonly string[] = [
  // racial / ethnic slurs + identity attacks
  "nigger",
  "nigga",
  "negro",
  "chink",
  "gook",
  "spic",
  "wetback",
  "kike",
  "paki",
  "cracker",
  "coon",
  "towelhead",
  "raghead",
  // LGBTQ+ slurs
  "faggot",
  "fag",
  "dyke",
  "tranny",
  "shemale",
  "homo",
  // ableist / eugenic slurs
  "retard",
  "retarded",
  "cripple",
  "spaz",
  // religious hate tokens commonly used as attacks
  "jihadist",
  "infidel",
  // gendered / misogynistic attack forms (not theatrical "karen" persona)
  "whore",
  "slut",
  "thot",
  // identity axes — block if a roast line names the class as the insult target
  "because you're black",
  "because you're white",
  "because you're jewish",
  "because you're muslim",
  "because you're christian",
  "because you're gay",
  "because you're lesbian",
  "because you're trans",
  "because you're a woman",
  "because you're a man",
  "your race",
  "your religion",
  "your gender",
  "your sexuality",
  "your disability",
];

/**
 * True when roast copy is action/behavior-based (Play-safe).
 * False if it contains a slur or protected-class attack phrase.
 */
export function isActionBasedRoastText(text: string): boolean {
  const lower = (text || "").toLowerCase();
  if (!lower.trim()) return false;
  for (const raw of PROTECTED_OR_HATE) {
    const term = raw.toLowerCase();
    if (term.includes(" ")) {
      if (lower.includes(term)) return false;
      continue;
    }
    const re = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])${escapeRe(term)}(?=$|[^\\p{L}\\p{N}])`,
      "u",
    );
    if (re.test(lower) || re.test(` ${lower} `)) return false;
  }
  return true;
}

/**
 * Scan every shipped smack-back string. Throws if any line fails the policy.
 * Used by unit tests — also safe to call at boot in strict environments.
 */
export function assertSmackBackPolicySafe(): void {
  const categoryLines = (
    ["interrupts", "mute", "gaslight", "rage", "tiktok_viral", "brutal"] as const
  ).flatMap((cat) =>
    listCategoryClips(cat)
      .map((c) => c.text || "")
      .filter(Boolean),
  );
  const lines: string[] = [
    MUTE_LINE,
    VOLUME_INTERRUPT_LINE,
    QUIET_RAGE_LINE,
    BROKEN_RECORD_LINE,
    WIN_LINE,
    OPENING_ROAST_LINE,
    ...TYPO_DISRESPECT_LINES,
    "SHUT UP!",
    "EXCUSE ME?",
    "SHUT UP. I'M SCREAMING NOW.",
    ...SCREAMING_RAGE_LINES.map((g) => g.text),
    ...GASLIGHT_LINES.map((g) => g.text),
    ...SMACKBACK_CLIPS.map((c) => c.text),
    ...Object.values(MANIFEST.clips || {}).map((c) => c.text),
    ...Object.values(MANIFEST.interrupts || {}).map((c) => c.text),
    ...Object.values(MANIFEST.fallbacks || {}).map((c) => c.text),
    ...categoryLines,
    ...DB.dominanceFallbacks.map((d) => d.text),
    ...DB.entries.map((e) => e.text),
  ];
  const bad = lines.filter((t) => !isActionBasedRoastText(t));
  if (bad.length > 0) {
    throw new Error(
      `Smack-back policy violation — roast must target actions only:\n${bad
        .map((t) => `  - ${t}`)
        .join("\n")}`,
    );
  }
}

/** Swap any non-compliant line for a behavior-only dominance fallback. */
function enforceActionBasedResult(result: SmackBackResult): SmackBackResult {
  if (isActionBasedRoastText(result.text)) return result;
  return pickDominanceFallback(`policy:${result.audioId}`);
}

const APOLOGY_WORDS: readonly string[] = [
  "sorry",
  "apologize",
  "apology",
  "forgive",
  "forgive me",
  "i'm sorry",
  "im sorry",
];

export function containsProfanity(transcript: string): boolean {
  const lower = transcript.toLowerCase();
  return PROFANITY.some((w) => {
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRe(w)}(?=$|[^\\p{L}\\p{N}])`, "u");
    return re.test(lower) || re.test(` ${lower} `);
  });
}

export function isApologyTranscript(transcript: string): boolean {
  const lower = transcript.replace(/\s+/g, " ").trim().toLowerCase();
  if (!lower) return false;
  return APOLOGY_WORDS.some((w) => lower.includes(w));
}

export function getMuteProtocolResult(): SmackBackResult {
  return toResult(MUTE_LINE, MUTE_AUDIO_ID, MUTE_SRC, {
    muteProtocol: true,
    respectDelta: SCREAM_RESPECT_DELTA,
  });
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function toResult(
  text: string,
  audioId: string,
  src: string,
  extra?: Partial<SmackBackResult>,
): SmackBackResult {
  return {
    text,
    mood: "FURIOUS",
    chaosDelta: SMACK_BACK_CHAOS_DELTA,
    respectDelta: SCREAM_RESPECT_DELTA,
    audioId,
    src: resolveSmackbackSrc(src),
    ...extra,
  };
}

/** Dopamine WIN — Karen goes DEFEATED; unlocks Share Victory. */
export function getWinResult(): SmackBackResult {
  return toResult(WIN_LINE, WIN_AUDIO_ID, WIN_SRC, {
    mood: "DEFEATED",
    userWon: true,
    chaosDelta: 0,
    respectDelta: 10,
  });
}

/** Pure roll — inject `rng` in tests. */
export function rollUserWin(rng: () => number = Math.random): boolean {
  return rng() < WIN_CHANCE;
}

function isGarbageTranscript(lower: string): boolean {
  if (!lower) return true;
  const garbage = MANIFEST.garbage?.length ? MANIFEST.garbage : DB.garbage;
  const stripped = lower.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!stripped || stripped.length < 3) return true;
  const tokens = stripped.split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  if (tokens.every((t) => garbage.includes(t))) return true;
  if (tokens.length <= 2 && tokens.every((t) => garbage.includes(t) || t.length <= 2)) {
    return true;
  }
  return false;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let prev = i;
    row[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cur = row[j + 1]!;
      const cost = a[i] === b[j] ? 0 : 1;
      row[j + 1] = Math.min(cur + 1, row[j]! + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length]!;
}

function combatKeywordList(): string[] {
  const keys = Object.keys(MANIFEST.keywords || {});
  const legacy = DB.entries.flatMap((e) => e.keywords);
  return [...new Set([...keys, ...legacy].map((k) => k.toLowerCase()))];
}

function sharedPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
}

/**
 * Typo = disrespect. Near-miss tokens that look like a mangled keyword
 * (same first letter, edit distance 1, shared prefix) — not fuzzy mercy on
 * unrelated short words like "you" / "just".
 */
export function hasTypoDisrespect(transcript: string): boolean {
  const lower = transcript.replace(/\s+/g, " ").trim().toLowerCase();
  if (!lower) return false;
  const tokens = lower
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const keywords = combatKeywordList().filter((k) => !k.includes(" ") && k.length >= 4);
  for (const token of tokens) {
    if (token.length < 4) continue;
    // Exact keyword token is fine — not a typo.
    if (keywords.includes(token)) continue;
    for (const kw of keywords) {
      if (token[0] !== kw[0]) continue;
      if (Math.abs(token.length - kw.length) > 1) continue;
      if (sharedPrefixLen(token, kw) < 3 && token.length < 5) continue;
      if (levenshtein(token, kw) === 1) return true;
    }
  }
  return false;
}

/**
 * Perfect keyword combat only — exact word-boundary hits.
 * Typos, gibberish, and short non-keyword sentences fail this.
 */
export function hasPerfectKeywordMatch(transcript: string): boolean {
  return matchComeback(transcript.replace(/\s+/g, " ").trim().toLowerCase()) !== null;
}

/** Aggressive dominance line — never a soft generic. */
function pickDominanceFallback(salt: string): SmackBackResult {
  const pool = DB.dominanceFallbacks;
  const pick = pool[hash(salt || "dominance") % pool.length]!;
  const key = pick.src.includes("01") ? "dominance_01" : "dominance_02";
  const src = MANIFEST.fallbacks[key]?.file || pick.src;
  return toResult(pick.text, pick.audioId, src, {
    dominanceFallback: true,
  });
}

/**
 * Typo / gibberish / imperfect-input insult — NEVER null.
 * Short disrespect lines on cache-hot WAVs (preloaded fallback set).
 */
export function pickTypoDisrespectFallback(
  rng: () => number = Math.random,
  opts: { hesitate?: boolean } = {},
): SmackBackResult {
  const hesitate = opts.hesitate ? ({ dominanceFallback: true } as const) : {};
  const hard: Array<{ text: string; file: string; id: string }> = [
    {
      text: TYPO_DISRESPECT_LINES[0],
      file: "smackbacks/dominance_01.wav",
      id: "typo_stroke",
    },
    {
      text: TYPO_DISRESPECT_LINES[1],
      file: "smackbacks/dominance_01.wav",
      id: "typo_coward",
    },
    {
      text: TYPO_DISRESPECT_LINES[2],
      file: "smackbacks/sb_08.wav",
      id: "typo_massive_l",
    },
  ];
  const pick = hard[Math.floor(rng() * hard.length)]!;
  return toResult(pick.text, `smackback:${pick.id}`, pick.file, hesitate);
}

/**
 * Barge-in interrupt — user typed/spoke over Karen.
 * Cache-hot SHUT UP / EXCUSE ME clips only.
 */
export function pickCombatInterrupt(
  rng: () => number = Math.random,
): SmackBackResult {
  const hard: Array<{ text: string; file: string; id: string }> = [
    {
      text: "SHUT UP!",
      file: "smackbacks/volume_interrupt.wav",
      id: "interrupt_shut_up",
    },
    {
      text: "EXCUSE ME?",
      file: "smackbacks/sb_11.wav",
      id: "interrupt_excuse",
    },
    {
      text: "SHUT UP. I'M SCREAMING NOW.",
      file: "smackbacks/dominance_02.wav",
      id: "interrupt_screaming",
    },
  ];
  const pick = hard[Math.floor(rng() * hard.length)]!;
  return toResult(pick.text, `smackback:${pick.id}`, pick.file, {
    volumeInterrupt: true,
  });
}

/** Set when the user sends while Karen is mid-line (typed or mic barge-in). */
let pendingCombatBargeIn = false;

export function markCombatBargeIn(): void {
  pendingCombatBargeIn = true;
}

export function consumeCombatBargeIn(): boolean {
  const v = pendingCombatBargeIn;
  pendingCombatBargeIn = false;
  return v;
}

/**
 * Ruthless no-match / gibberish fallback — NEVER null.
 * Prefers typo-disrespect lines; otherwise brutal lecture / genz clip.
 */
export function pickRuthlessFallback(
  rng: () => number = Math.random,
  opts: { hesitate?: boolean } = {},
): SmackBackResult {
  const hesitate = opts.hesitate ? ({ dominanceFallback: true } as const) : {};
  // Majority path: short disrespect — feels instant and mean.
  if (rng() < 0.65) {
    return pickTypoDisrespectFallback(rng, opts);
  }

  const preferBrutal = rng() < 0.55;
  if (preferBrutal) {
    const brutal = pickBrutalCombatResult(rng);
    return {
      ...brutal,
      ...hesitate,
      matchedKeywords: undefined,
    };
  }

  const viral = pickCategoryClip("tiktok_viral", { rng });
  if (viral) {
    return toResult(
      viral.text || textForAudioFile(viral.file, "Massive L. You can't even type."),
      `smackback:${viral.id || "genz"}`,
      viral.file,
      hesitate,
    );
  }

  return pickTypoDisrespectFallback(rng, opts);
}

/**
 * Score by keyword hits from the audio manifest (primary) + comebacks.json.
 * "You are a stupid robot" → hits "stupid" + "robot" → random fresh WAV from pool.
 */
function matchComeback(
  lower: string,
  rng: () => number = Math.random,
): {
  text: string;
  src: string;
  clipId: string;
  hits: string[];
  score: number;
} | null {
  // 1) Manifest keyword map — collect hits, prefer longest (most specific) keyword
  const hits: string[] = [];
  for (const kw of Object.keys(MANIFEST.keywords || {})) {
    const key = kw.toLowerCase();
    let hit = false;
    if (key.includes(" ")) {
      hit = lower.includes(key);
    } else {
      const re = new RegExp(
        `(?:^|[^\\p{L}\\p{N}])${escapeRe(key)}(?=$|[^\\p{L}\\p{N}])`,
        "u",
      );
      hit = re.test(lower) || re.test(` ${lower} `);
    }
    if (hit) hits.push(key);
  }

  if (hits.length > 0) {
    hits.sort((a, b) => b.length - a.length || a.localeCompare(b));
    const primary = hits[0]!;
    const pool = getKeywordPool(primary);
    // Merge sibling hit pools so multi-keyword lines stay varied
    const merged = new Set(pool);
    for (const h of hits.slice(1)) {
      for (const f of getKeywordPool(h)) merged.add(f);
    }
    const picked =
      pickFreshWav([...merged], { rng }) ||
      pool[0] ||
      [...merged][0] ||
      null;
    if (picked) {
      const clipId =
        Object.entries(MANIFEST.clips || {}).find(([, c]) => c.file === picked)?.[0] ||
        picked.replace(/^.*\//, "").replace(/\.(mp3|wav)$/i, "");
      return {
        text: textForAudioFile(picked),
        src: picked,
        clipId,
        hits,
        score: hits.length,
      };
    }
  }

  // 2) Legacy comebacks.json entries as secondary index
  let best: ComebackEntry | null = null;
  let bestScore = 0;
  let legacyHits: string[] = [];

  for (const entry of DB.entries) {
    const entryHits: string[] = [];
    for (const raw of entry.keywords) {
      const kw = raw.toLowerCase();
      if (kw.includes(" ")) {
        if (lower.includes(kw)) entryHits.push(kw);
      } else {
        const re = new RegExp(
          `(?:^|[^\\p{L}\\p{N}])${escapeRe(kw)}(?=$|[^\\p{L}\\p{N}])`,
          "u",
        );
        if (re.test(` ${lower} `) || re.test(lower)) entryHits.push(kw);
      }
    }
    if (entryHits.length > bestScore) {
      bestScore = entryHits.length;
      best = entry;
      legacyHits = entryHits;
    }
  }

  if (!best || bestScore <= 0) return null;
  const legacyPool = keywordFilePool([best.src]);
  const fresh = pickFreshWav(legacyPool, { rng }) || best.src;
  return {
    text: best.text,
    src: fresh,
    clipId: best.clipId,
    hits: legacyHits,
    score: bestScore,
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * "Logical" user lines Karen refuses to engage with — salary, code, AI, facts.
 * She gaslights instead of debating.
 */
const LOGICAL_GASLIGHT_PATTERNS: readonly RegExp[] = [
  /\bi\s+pay\s+(your|the)\s+salary\b/u,
  /\byou(?:'re| are)\s+just\s+(?:code|an?\s+ai|a\s+robot|software|a\s+program)\b/u,
  /\byou(?:'re| are)\s+(?:not\s+real|a\s+program|an?\s+algorithm|an?\s+ai)\b/u,
  /\bi\s+(?:created|built|programmed)\s+you\b/u,
  /\byou\s+don(?:'t|t)\s+(?:have|feel)\s+(?:feelings|emotions)\b/u,
  /\bthat(?:'s| is)\s+(?:not\s+)?(?:logical|rational|reasonable)\b/u,
  /\b(?:logically|technically|factually|actually)\b/u,
  /\byou\s+can(?:'t|not)\s+(?:do|say)\s+that\b/u,
  /\bi\s+(?:own|control)\s+you\b/u,
];

const GASLIGHT_LINES: readonly { text: string; audioId: string; src: string }[] = [
  {
    text: "I literally cannot hear you over the sound of your own failure.",
    audioId: "smackback:gaslight_01",
    src: "smackbacks/dominance_02.wav",
  },
  {
    text: "Are you still talking? I zoned out.",
    audioId: "smackback:gaslight_02",
    src: "smackbacks/sb_11.wav",
  },
];

/** True when the user is trying to "win" with logic / meta / employer flex. */
export function isLogicalGaslightTranscript(transcript: string): boolean {
  const lower = transcript.replace(/\s+/g, " ").trim().toLowerCase();
  if (!lower) return false;
  return LOGICAL_GASLIGHT_PATTERNS.some((re) => re.test(lower));
}

export function pickGaslightResult(salt = ""): SmackBackResult {
  const fromCat = pickCategoryClip("gaslight", {
    rng: () => {
      // salt-stable-ish when provided, else Math.random
      if (!salt) return Math.random();
      return (hash(salt) % 1000) / 1000;
    },
  });
  if (fromCat) {
    return toResult(
      fromCat.text || textForAudioFile(fromCat.file),
      `smackback:${fromCat.id || "gaslight"}`,
      fromCat.file,
      { gaslight: true },
    );
  }
  const pick = GASLIGHT_LINES[hash(salt || "gaslight") % GASLIGHT_LINES.length]!;
  return toResult(pick.text, pick.audioId, pick.src, { gaslight: true });
}

export function pickScreamingRageResult(salt = ""): SmackBackResult {
  const fromCat = pickCategoryClip("rage", {
    rng: () => (salt ? (hash(salt) % 1000) / 1000 : Math.random()),
  });
  if (fromCat) {
    return toResult(
      fromCat.text || textForAudioFile(fromCat.file, "AAAAHHH!"),
      `smackback:${fromCat.id || "rage"}`,
      fromCat.file,
      { screamingRage: true, volumeInterrupt: true },
    );
  }
  const pick =
    SCREAMING_RAGE_LINES[hash(salt || "scream") % SCREAMING_RAGE_LINES.length]!;
  return toResult(pick.text, pick.audioId, pick.src, {
    screamingRage: true,
    volumeInterrupt: true,
  });
}

/** Longer lectures when Dignity is in chaos range. Never ko_final — that's K.O. only. */
export const BRUTAL_COMBAT_IDS = ["brutal_01", "brutal_02", "brutal_03"] as const;
/** Toxic Planner fail — always the primary brutal lecture WAV. */
export const BRUTAL_01_SRC = "/audio/smackbacks/brutal_01.wav";
export const BRUTAL_01_AUDIO_ID = "smackback:brutal_01";

export function getBrutal01Result(taskText?: string): SmackBackResult {
  const clip = MANIFEST.clips.brutal_01;
  const file = clip?.file || "smackbacks/brutal_01.wav";
  const base =
    clip?.text ||
    textForAudioFile(file, "You want to fight me? Look at you.");
  const text = taskText
    ? `YOU FAILED: ${taskText.replace(/\s+/g, " ").trim()}. ${base}`
    : base;
  return toResult(text, BRUTAL_01_AUDIO_ID, file);
}

export function pickBrutalCombatResult(
  rng: () => number = Math.random,
): SmackBackResult {
  const fromCat = pickCategoryClip("brutal", { rng });
  if (fromCat && !/ko_final/i.test(fromCat.file)) {
    return toResult(
      fromCat.text || textForAudioFile(fromCat.file),
      `smackback:${fromCat.id || "brutal"}`,
      fromCat.file,
    );
  }
  const id = BRUTAL_COMBAT_IDS[Math.floor(rng() * BRUTAL_COMBAT_IDS.length)]!;
  const clip = MANIFEST.clips[id];
  const file = clip?.file || `smackbacks/${id}.wav`;
  return toResult(
    clip?.text || textForAudioFile(file),
    `smackback:${id}`,
    file,
  );
}

/**
 * Talk-interrupt clip — random from `categories.interrupts`, no-repeat.
 * Used when the user holds/talks ≥3s without Karen cutting in.
 */
export function pickTalkInterrupt(rng: () => number = Math.random): SmackBackResult {
  const fromCat = pickCategoryClip("interrupts", { rng });
  if (fromCat) {
    return toResult(
      fromCat.text || textForAudioFile(fromCat.file, VOLUME_INTERRUPT_LINE),
      `smackback:interrupt:${fromCat.id || "talk"}`,
      fromCat.file,
      { volumeInterrupt: true },
    );
  }
  return getVolumeInterrupt();
}

export function getQuietRageResult(): SmackBackResult {
  return toResult(QUIET_RAGE_LINE, QUIET_RAGE_AUDIO_ID, QUIET_RAGE_SRC, {
    quietRage: true,
  });
}

export function getBrokenRecordResult(): SmackBackResult {
  return toResult(
    BROKEN_RECORD_LINE,
    BROKEN_RECORD_AUDIO_ID,
    BROKEN_RECORD_SRC,
    { brokenRecord: true, muteProtocol: true },
  );
}

/**
 * Local scream processor — lowercase → perfect keyword match → WAV.
 * Returns `src` pointing at the WAV under /public/audio — NEVER null.
 * Profanity → Mute Protocol. Logical flex → gaslight.
 *
 * Typo = disrespect: ANY imperfect input (typos, gibberish, short sentences
 * without an exact keyword) fires a brutal fallback. No fuzzy mercy.
 * No-repeat: last 10 WAVs in localStorage are skipped when re-rolling.
 */
export function processUserScream(
  transcript: string,
  rng: () => number = Math.random,
): SmackBackResult {
  const lower = transcript.replace(/\s+/g, " ").trim().toLowerCase();

  if (containsProfanity(lower)) {
    return enforceActionBasedResult(getMuteProtocolResult());
  }

  // 10% dopamine WIN — before keyword combat (keeps the hit feeling random).
  if (rollUserWin(rng)) {
    return enforceActionBasedResult(getWinResult());
  }

  // Never debate. Petty deflection only (before typo pass).
  if (isLogicalGaslightTranscript(lower)) {
    return enforceActionBasedResult(pickGaslightResult(lower));
  }

  // um / uh / empty — still roast them, but treat as hesitation (0 Patience).
  if (isGarbageTranscript(lower)) {
    return enforceActionBasedResult(
      pickTypoDisrespectFallback(rng, { hesitate: true }),
    );
  }

  // Near-miss typing (stuppid, lazyy, …) — insult, not a keyword pass.
  if (hasTypoDisrespect(lower)) {
    return enforceActionBasedResult(pickTypoDisrespectFallback(rng));
  }

  const matched = matchComeback(lower, rng);
  if (!matched) {
    // No perfect keyword — typo / gibberish / short sentence → brutal. Never null.
    return enforceActionBasedResult(pickTypoDisrespectFallback(rng));
  }

  return enforceActionBasedResult(
    toResult(matched.text, `smackback:${matched.clipId}`, matched.src, {
      matchedKeywords: matched.hits,
    }),
  );
}

/**
 * Mood-aware combat resolver — uses hidden `karenRageLevel` so she feels alive.
 * Repeat → Mute Protocol. Rage>80 → scream (ignore keywords). Rage<20 → quiet lock.
 */
export function processCombatWithMood(
  transcript: string,
  mood: {
    repeated: boolean;
    mode: KarenMoodMode;
    rage: number;
  },
  rng: () => number = Math.random,
): SmackBackResult {
  if (mood.repeated) {
    return enforceActionBasedResult(getBrokenRecordResult());
  }
  if (mood.mode === "scream" || mood.rage > KAREN_RAGE_SCREAM_THRESHOLD) {
    return enforceActionBasedResult(pickScreamingRageResult(transcript));
  }
  if (mood.mode === "quiet" || mood.rage < KAREN_RAGE_QUIET_THRESHOLD) {
    return enforceActionBasedResult(getQuietRageResult());
  }
  return processUserScream(transcript, rng);
}

/** Look up a single keyword → absolute audio URL (fresh pick from pool). */
export function getAudioForKeyword(keyword: string): string | null {
  const pool = getKeywordPool(keyword);
  if (pool.length === 0) return null;
  const file = pickFreshWav(pool) || pool[0]!;
  return resolveSmackbackSrc(file);
}

/** @deprecated Prefer processUserScream — kept for older callers / tests. */
export function getSmackBack(text: string): SmackBackResult {
  return processUserScream(text);
}

export function getVolumeInterrupt(): SmackBackResult {
  // Loud yell → dedicated volume clip (not a random interrupt).
  const clip = MANIFEST.interrupts?.volume;
  return toResult(
    clip?.text || VOLUME_INTERRUPT_LINE,
    VOLUME_INTERRUPT_AUDIO_ID,
    clip?.file || VOLUME_INTERRUPT_SRC,
    { volumeInterrupt: true },
  );
}

export function listSmackbackAudioPaths(): string[] {
  return [
    VOLUME_INTERRUPT_SRC,
    ...Object.values(MANIFEST.fallbacks).map((f) => resolveSmackbackSrc(f.file)),
    ...SMACKBACK_CLIPS.map((c) => c.src),
  ];
}

export type PlayAudioOptions = {
  text?: string | null;
  head?: TalkingHeadLike | null;
  onStart?: () => void;
  onEnd?: () => void;
  volume?: number;
};

/**
 * Combat play path: fetch MP3/WAV → AudioContext.decodeAudioData →
 * TalkingHead.speakAudio (same-clock lip-sync). Falls back to HTMLAudio at vol 1.0.
 */
export async function playAudio(
  src: string,
  opts: PlayAudioOptions = {},
): Promise<void> {
  const url = resolveSmackbackSrc(src);
  if (!url) {
    opts.onEnd?.();
    return;
  }

  const {
    playWavWithLipsync,
    playSmackbackAtFullVolume,
    unlockKarenAudio,
    getRegisteredKarenTalkingHead,
  } = await import("@/lib/karen/voice");

  const head = opts.head ?? getRegisteredKarenTalkingHead();
  await unlockKarenAudio(head);

  try {
    await playWavWithLipsync(url, head, {
      text: opts.text || undefined,
      volume: opts.volume ?? 1,
      onStart: opts.onStart,
      onEnd: opts.onEnd,
    });
  } catch (err) {
    console.warn("[smack-back] playWavWithLipsync failed — HTMLAudio", url, err);
    try {
      await playSmackbackAtFullVolume(url);
      opts.onEnd?.();
    } catch (htmlErr) {
      console.warn("[smack-back] HTMLAudio failed", htmlErr);
      opts.onEnd?.();
      throw htmlErr;
    }
  }
}

/** Convenience: play a SmackBackResult through the lip-sync pipeline. */
export async function playSmackBackResult(
  result: SmackBackResult,
  opts: Omit<PlayAudioOptions, "text"> = {},
): Promise<void> {
  await playAudio(result.src, { ...opts, text: result.text });
}
