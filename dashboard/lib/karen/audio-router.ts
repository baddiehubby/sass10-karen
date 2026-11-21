/**
 * Scalable Kokoro audio router — keyword → WAV pool + no-repeat history.
 * Recent plays live in localStorage (last 10) so insults stay fresh.
 */

import audioManifest from "@/data/audio-manifest.json";

export const RECENT_WAV_STORAGE_KEY = "karen.audio.recentWavs";
export const RECENT_WAV_LIMIT = 10;

export type AudioCategoryId =
  | "smackbacks"
  | "interrupts"
  | "mute"
  | "gaslight"
  | "rage"
  | "tiktok_viral"
  | "brutal";

export type CategoryClip = {
  id?: string;
  file: string;
  text?: string;
};

type ManifestShape = {
  basePath?: string;
  keywords?: Record<string, string | string[]>;
  categories?: Partial<Record<AudioCategoryId, Array<string | CategoryClip>>>;
  clips?: Record<string, { file: string; text: string }>;
};

const MANIFEST = audioManifest as ManifestShape;

type MemoryStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/** In-memory fallback for SSR / private mode / unit tests. */
const memoryStore = new Map<string, string>();

function defaultStore(): MemoryStore {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: (k) => memoryStore.get(k) ?? null,
    setItem: (k, v) => {
      memoryStore.set(k, v);
    },
  };
}

/** Normalize keyword map entry → unique relative file paths. */
export function keywordFilePool(
  entry: string | string[] | null | undefined,
): string[] {
  if (!entry) return [];
  const raw = Array.isArray(entry) ? entry : [entry];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const file = String(item || "").trim();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    out.push(file);
  }
  return out;
}

/** Read last N played relative paths (newest last). */
export function readRecentWavs(
  store: MemoryStore = defaultStore(),
  limit = RECENT_WAV_LIMIT,
): string[] {
  try {
    const raw = store.getItem(RECENT_WAV_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(-limit);
  } catch {
    return [];
  }
}

export function rememberPlayedWav(
  file: string,
  store: MemoryStore = defaultStore(),
  limit = RECENT_WAV_LIMIT,
): string[] {
  const rel = file.trim();
  if (!rel) return readRecentWavs(store, limit);
  const next = readRecentWavs(store, limit).filter((f) => f !== rel);
  next.push(rel);
  const trimmed = next.slice(-limit);
  try {
    store.setItem(RECENT_WAV_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / private mode */
  }
  return trimmed;
}

export function clearRecentWavs(store: MemoryStore = defaultStore()): void {
  try {
    store.setItem(RECENT_WAV_STORAGE_KEY, "[]");
  } catch {
    memoryStore.delete(RECENT_WAV_STORAGE_KEY);
  }
}

/**
 * Pick a random file from `pool`, re-rolling if it's in the last 10.
 * If every option is recent, pick the least-recently-used among the pool.
 */
export function pickFreshWav(
  pool: readonly string[],
  opts: {
    rng?: () => number;
    store?: MemoryStore;
    remember?: boolean;
  } = {},
): string | null {
  const files = keywordFilePool([...pool]);
  if (files.length === 0) return null;

  const rng = opts.rng ?? Math.random;
  const store = opts.store ?? defaultStore();
  const recent = readRecentWavs(store);
  const recentSet = new Set(recent);
  const fresh = files.filter((f) => !recentSet.has(f));
  const candidates = fresh.length > 0 ? fresh : files;

  // Prefer least-recent when forced to reuse.
  let pick: string;
  if (fresh.length === 0 && candidates.length > 1) {
    const ranked = [...candidates].sort((a, b) => {
      const ia = recent.indexOf(a);
      const ib = recent.indexOf(b);
      return ia - ib; // older (or missing = -1) first
    });
    pick = ranked[0]!;
  } else {
    pick = candidates[Math.floor(rng() * candidates.length)]!;
  }

  if (opts.remember !== false) rememberPlayedWav(pick, store);
  return pick;
}

export function getKeywordPool(keyword: string): string[] {
  const entry = MANIFEST.keywords?.[keyword.toLowerCase().trim()];
  return keywordFilePool(entry);
}

export function listCategoryClips(category: AudioCategoryId): CategoryClip[] {
  const raw = MANIFEST.categories?.[category] || [];
  return raw.map((item, i) => {
    if (typeof item === "string") {
      return { id: `${category}_${i}`, file: item };
    }
    return {
      id: item.id || `${category}_${i}`,
      file: item.file,
      text: item.text,
    };
  });
}

export function pickCategoryClip(
  category: AudioCategoryId,
  opts: {
    rng?: () => number;
    store?: MemoryStore;
    remember?: boolean;
  } = {},
): CategoryClip | null {
  const clips = listCategoryClips(category);
  if (clips.length === 0) return null;
  const file = pickFreshWav(
    clips.map((c) => c.file),
    opts,
  );
  if (!file) return null;
  return clips.find((c) => c.file === file) || { file };
}

/** Resolve roast text for a relative file via clips catalog. */
export function textForAudioFile(file: string, fallback = "Is that all you've got?"): string {
  const clips = MANIFEST.clips || {};
  const base = file.replace(/^.*\//, "").replace(/\.(mp3|wav)$/i, "");
  for (const [id, clip] of Object.entries(clips)) {
    if (id === base || clip.file === file || clip.file.endsWith(`/${base}.wav`)) {
      return clip.text || fallback;
    }
  }
  // angry_XX / alias files — soft default
  if (/angry_/i.test(file)) return "AAAAHHH!";
  if (/volume_interrupt/i.test(file)) {
    return "DON'T YOU DARE RAISE YOUR VOICE AT ME!";
  }
  if (/dominance_01/i.test(file)) return "Speak up. I don't speak coward.";
  if (/dominance_02/i.test(file)) return "Is that all you've got? Pathetic.";
  if (/done_listening/i.test(file)) return "I'm done listening. Go do laundry.";
  if (/ko_final/i.test(file)) {
    return "Game over. You lost. Not just to me, but to your own lack of discipline. I want you to take a long, hard look in the mirror. That person staring back? They're a failure. Now log off, and don't come back until you've actually done something with your life.";
  }
  if (/brutal_01/i.test(file)) {
    return "You want to fight me? Look at you. You can't even fight your own laziness. You sit there, hiding behind a screen, hoping I'll give you a pat on the back. Here's the truth: you're a coward. And until you actually do something with your miserable life, I will keep reminding you of how pathetic you are.";
  }
  if (/brutal_02/i.test(file)) {
    return "Oh, you think you're winning? You are a walking, breathing excuse factory. Every time you open your mouth, a new pathetic reason falls out. I've seen roadkill with more ambition than you. Get off your phone, stop arguing with an AI, and go fix your life.";
  }
  if (/brutal_03/i.test(file)) {
    return "You scream at me like you're a tough guy, but the moment things get hard, you quit. You quit your goals, you quit your diet, and now you're trying to quit this conversation because you know I'm right. You are weak. Now get up and prove me wrong.";
  }
  return fallback;
}

/** Test helper — wipe in-memory store between cases. */
export function resetAudioRouterMemory(): void {
  memoryStore.clear();
}
