/**
 * Optional tiny local enhancer — lazy, never blocking, never a large download.
 * When impractical or unloadable, Soul Engine continues alone (same Buddie).
 */

export type TinyLocalEnhancer = {
  ready: boolean;
  /** Soften / diversify wording slightly; returns original on no-op. */
  enrich: (text: string, seed: string) => string;
};

const IDENTITY: TinyLocalEnhancer = {
  ready: false,
  enrich: (text) => text,
};

let enhancerPromise: Promise<TinyLocalEnhancer> | null = null;
let enhancer: TinyLocalEnhancer = IDENTITY;

export function getTinyLocalEnhancerSync(): TinyLocalEnhancer {
  return enhancer;
}

/** Non-blocking warm-up. Resolves to identity if anything fails. */
export function warmOptionalTinyModel(enabled: boolean): Promise<TinyLocalEnhancer> {
  if (!enabled) {
    enhancer = IDENTITY;
    return Promise.resolve(IDENTITY);
  }
  if (enhancerPromise) return enhancerPromise;

  enhancerPromise = Promise.resolve()
    .then(async () => {
      // Intentionally tiny & local: no network, no WASM blob, no API keys.
      // Future: hook a <5MB optional module here via dynamic import only when practical.
      const mod = await import("@/src/intelligence/adaptive/tiny-enricher").catch(() => null);
      if (!mod?.createTinyEnricher) return IDENTITY;
      const next = mod.createTinyEnricher();
      enhancer = next;
      return next;
    })
    .catch(() => IDENTITY);

  return enhancerPromise;
}

export function resetTinyLocalEnhancer(): void {
  enhancerPromise = null;
  enhancer = IDENTITY;
}
