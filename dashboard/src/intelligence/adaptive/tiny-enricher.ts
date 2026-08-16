/**
 * Micro enricher — procedural only. No model weights. No network.
 */

export function createTinyEnricher(): {
  ready: boolean;
  enrich: (text: string, seed: string) => string;
} {
  return {
    ready: true,
    enrich(text: string, seed: string): string {
      if (!text || text.length < 12) return text;
      const h = hash(seed + text) % 5;
      // Light procedural variation only — same personality, never "AI fallback" copy.
      if (h === 0 && !text.includes("—")) {
        return text.replace(/\. (\S)/, ". — $1");
      }
      if (h === 1 && text.endsWith(".") && text.length < 160) {
        return `${text.slice(0, -1)}.`;
      }
      return text;
    },
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
