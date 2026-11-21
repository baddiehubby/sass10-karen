/**
 * Development-only audio / lip-sync diagnostics.
 * `process.env.NODE_ENV` is inlined at build time, so these calls (and their
 * arguments) are dead-code-eliminated from production bundles.
 */
export const KAREN_DEV = process.env.NODE_ENV === "development";

export function karenDevLog(message: string, detail?: unknown): void {
  if (!KAREN_DEV) return;
  if (detail === undefined) console.info(`[karen/audio-test] ${message}`);
  else console.info(`[karen/audio-test] ${message}`, detail);
}

export function karenDevWarn(message: string, detail?: unknown): void {
  if (!KAREN_DEV) return;
  if (detail === undefined) console.warn(`[karen/audio-test] ${message}`);
  else console.warn(`[karen/audio-test] ${message}`, detail);
}
