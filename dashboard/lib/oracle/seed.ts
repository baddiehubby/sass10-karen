export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededUnit(seed: number, salt: number): number {
  const x = Math.imul(seed ^ (salt * 374761393), 668265263);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967295;
}

export function pickFrom<T>(items: readonly T[], seed: number, salt: number): T {
  const i = Math.floor(seededUnit(seed, salt) * items.length);
  return items[Math.min(items.length - 1, Math.max(0, i))];
}

export function dayKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
