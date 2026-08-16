/**
 * Procedural variation — strong anti-repetition across families and wording.
 */

export type VariationState = {
  recentFamilies: string[];
  recentWording: string[];
  recentOpenings: string[];
  lastLength: number;
  lastTone: string;
};

export function createVariationState(partial?: Partial<VariationState>): VariationState {
  return {
    recentFamilies: partial?.recentFamilies ?? [],
    recentWording: (partial?.recentWording ?? []).map(normalizeWording),
    recentOpenings: partial?.recentOpenings ?? [],
    lastLength: partial?.lastLength ?? 0,
    lastTone: partial?.lastTone ?? "warm",
  };
}

export function pickVariant<T>(
  options: T[],
  seed: string,
  avoidIndexes: number[] = [],
): { item: T; index: number } {
  if (!options.length) throw new Error("pickVariant: empty options");
  if (options.length === 1) return { item: options[0]!, index: 0 };
  const blocked = new Set(avoidIndexes);
  const openIdx = options.map((_, i) => i).filter((i) => !blocked.has(i));
  const pool = openIdx.length ? openIdx : options.map((_, i) => i);
  const idx = pool[hash(seed) % pool.length]!;
  return { item: options[idx]!, index: idx };
}

export function chooseFamily(
  families: string[],
  recent: string[],
  seed: string,
  cooldown = 8,
): string {
  if (!families.length) throw new Error("chooseFamily: empty");
  const blocked = new Set(recent.slice(-cooldown));
  let open = families.filter((f) => !blocked.has(f));

  if (!open.length) {
    const counts = new Map<string, number>();
    for (const f of families) counts.set(f, 0);
    for (const f of recent.slice(-cooldown * 2)) {
      if (counts.has(f)) counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    const min = Math.min(...[...counts.values()]);
    open = families.filter((f) => (counts.get(f) ?? 0) === min);
    const last = recent[recent.length - 1];
    const withoutLast = open.filter((f) => f !== last);
    if (withoutLast.length) open = withoutLast;
  }

  return pickVariant(open, seed).item;
}

export function wordingSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeWording(a).split(" ").filter((w) => w.length > 2));
  const tb = new Set(normalizeWording(b).split(" ").filter((w) => w.length > 2));
  if (!ta.size || !tb.size) return normalizeWording(a) === normalizeWording(b) ? 1 : 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}

export function isTooSimilar(candidate: string, recent: string[], threshold = 0.52): boolean {
  const norm = normalizeWording(candidate);
  for (const r of recent.slice(-10)) {
    if (normalizeWording(r) === norm) return true;
    if (wordingSimilarity(candidate, r) >= threshold) return true;
  }
  return false;
}

export function avoidRepeatText(candidate: string, recent: string[], seed = "mut"): string {
  let text = candidate;
  let guard = 0;
  while (isTooSimilar(text, recent) && guard < 6) {
    text = mutateWording(text, `${seed}:${guard}`);
    guard += 1;
  }
  return text;
}

export function mutateWording(candidate: string, seed: string): string {
  const mode = hash(seed) % 5;
  if (mode === 0 && candidate.startsWith("I ")) return `Hmm — ${candidate.slice(2)}`;
  if (mode === 1 && candidate.includes(".")) {
    const parts = candidate.split(".").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return `${parts[parts.length - 1]}. ${parts.slice(0, -1).join(". ")}.`;
  }
  if (mode === 2) return candidate.replace(/\bthat\b/gi, "this").replace(/\bvery\b/gi, "pretty");
  if (mode === 3) {
    const openers = ["Softly —", "Quiet take:", "Between us,", "Real talk —", "Tiny thought:"];
    const o = openers[hash(seed) % openers.length]!;
    return `${o} ${candidate.charAt(0).toLowerCase()}${candidate.slice(1)}`;
  }
  return `${candidate.replace(/\.$/, "")}…`;
}

export function recordVariation(
  state: VariationState,
  familyId: string,
  text: string,
  tone: string,
): VariationState {
  const opening = text.split(/[.!?]/)[0]?.trim() ?? text.slice(0, 24);
  return {
    recentFamilies: [...state.recentFamilies, familyId].slice(-12),
    recentWording: [...state.recentWording, normalizeWording(text)].slice(-12),
    recentOpenings: [...state.recentOpenings, opening].slice(-12),
    lastLength: text.length,
    lastTone: tone,
  };
}

export function normalizeWording(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
