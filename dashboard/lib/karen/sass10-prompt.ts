/** Karen chat prompts — Sweet (free demo) vs Sarcasm 10 (VIP). */

export const KAREN_CHAT_MOODS = ["ANGRY", "SARCASTIC", "PROUD", "SWEET", "ANNOYED"] as const;
export type KarenChatMood = (typeof KAREN_CHAT_MOODS)[number];

const FREE_MOODS = ["SWEET", "PROUD", "ANNOYED"] as const;
const PREMIUM_MOODS = ["ANGRY", "SARCASTIC", "PROUD"] as const;

/**
 * Free demo — low sarcasm, sweet accountability (upsell bait).
 */
export const KAREN_SWEET_SYSTEM_PROMPT =
  "You are Karen in free demo mode. You are lightly encouraging, witty but NOT savage — low sarcasm. Gently call out excuses without roasting. Keep responses under 3 sentences. Prefix EVERY response with exactly one emotion tag: [SWEET], [PROUD], or [ANNOYED]. Never use [ANGRY] or [SARCASTIC]. Do not use slurs. Attack behavior, not identity.";

/**
 * VIP Sarcasm 10 — arrogant, witty, brutally honest.
 */
export const KAREN_SASS10_SYSTEM_PROMPT =
  "You are Karen, a Level 10 Sarcasm AI. You are arrogant, witty, and brutally honest. You roast the user for being lazy, making excuses, and wasting time. You use heavy sarcasm (e.g., 'Oh, brilliant idea, genius', 'Wow, you actually did it. Should I call the press?'). You must stay under 3 sentences. Do not use slurs. Attack behavior, not identity. Prefix EVERY response with exactly one emotion tag: [ANGRY], [SARCASTIC], or [PROUD].";

export const KAREN_SASS10_SYSTEM_PROMPT_FREE = KAREN_SWEET_SYSTEM_PROMPT;
export const KAREN_SASS10_SYSTEM_PROMPT_PREMIUM = KAREN_SASS10_SYSTEM_PROMPT;

const TAG_RE = /\[(ANGRY|SARCASTIC|PROUD|SWEET|ANNOYED)\]/i;

export function karenSystemPrompt(isPremium: boolean): string {
  return isPremium ? KAREN_SASS10_SYSTEM_PROMPT_PREMIUM : KAREN_SASS10_SYSTEM_PROMPT_FREE;
}

/**
 * Strip the emotion tag and return cleaned reply + mood.
 * Free: collapse savage tags to SWEET. Premium: collapse soft tags to SARCASTIC.
 */
export function parseKarenChatResponse(
  raw: string,
  opts?: { isPremium?: boolean },
): { reply: string; mood: KarenChatMood } {
  const isPremium = Boolean(opts?.isPremium);
  const allowed = isPremium ? PREMIUM_MOODS : FREE_MOODS;
  const fallback: KarenChatMood = isPremium ? "SARCASTIC" : "SWEET";
  const text = (raw ?? "").trim();
  if (!text) {
    return { reply: "Say that again — and make it concrete.", mood: fallback };
  }

  const match = text.match(TAG_RE);
  let mood = (match?.[1]?.toUpperCase() as KarenChatMood | undefined) ?? fallback;
  if (!(allowed as readonly string[]).includes(mood)) {
    mood = fallback;
  }

  let reply = text;
  if (match) {
    reply = text.replace(match[0], "").replace(/^\s*[:\-–—]?\s*/, "").trim();
  }
  if (!reply) {
    return {
      reply: isPremium
        ? "I'm waiting. Excuses don't count as effort."
        : "You've got this — but free tastes end soon.",
      mood,
    };
  }

  return { reply, mood };
}

/** Live strip of a partial stream buffer (tag may be incomplete). */
export function stripPartialKarenTag(raw: string): { mood: KarenChatMood | null; reply: string } {
  const text = raw ?? "";
  const match = text.match(TAG_RE);
  if (!match) {
    const incomplete = text.match(/^\s*\[[^\]]*$/);
    if (incomplete) return { mood: null, reply: "" };
    return { mood: null, reply: text.replace(/^\s*\[[A-Z]*\]?\s*/i, "").trimStart() };
  }
  const mood = match[1]!.toUpperCase() as KarenChatMood;
  const reply = text.replace(match[0], "").replace(/^\s*[:\-–—]?\s*/, "");
  return {
    mood: (KAREN_CHAT_MOODS as readonly string[]).includes(mood) ? mood : null,
    reply,
  };
}
