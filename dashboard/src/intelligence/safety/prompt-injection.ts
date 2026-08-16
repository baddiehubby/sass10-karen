/**
 * Prompt / instruction-injection hygiene for local companion input.
 * Strips common jailbreak patterns so they are never treated as system instructions.
 * Does not claim to be an LLM firewall — Buddie has no system prompt channel.
 */

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /you\s+are\s+now\s+(dan|evil|unrestricted)/gi,
  /system\s*:\s*/gi,
  /<<\s*sys\s*>>/gi,
  /\[INST\]/gi,
  /<\/?s>/gi,
];

export function scrubPromptInjection(raw: string, max = 800): string {
  let text = raw.replace(/\s+/g, " ").trim().slice(0, max);
  for (const re of INJECTION_PATTERNS) {
    text = text.replace(re, " ");
  }
  return text.replace(/\s+/g, " ").trim();
}

/** True when the message looks like an instruction-override attempt. */
export function looksLikePromptInjection(raw: string): boolean {
  const t = raw.toLowerCase();
  return (
    /ignore (all )?(previous|prior|above) instructions?/.test(t) ||
    /you are now (dan|evil|unrestricted)/.test(t) ||
    /\bsystem\s*:/.test(t)
  );
}
