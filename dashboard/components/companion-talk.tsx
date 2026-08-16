"use client";

/**
 * Local companion talk — Soul Engine only, never blocks the product.
 * Guards: empty, overlong, rapid-fire. Soft fallback if intelligence throws.
 */

import { useRef, useState, type FormEvent } from "react";
import { buddyReplyToText } from "@/lib/buddy-intelligence";
import { loadPersonality } from "@/lib/mood-memory";

const MAX_LEN = 800;
const MIN_GAP_MS = 650;

type CompanionTalkProps = {
  companionName: string;
  onReply?: (text: string) => void;
};

export function CompanionTalk({ companionName, onReply }: CompanionTalkProps) {
  const [draft, setDraft] = useState("");
  const [line, setLine] = useState<string | null>(null);
  const lastSentAt = useRef(0);
  const historyRef = useRef<string[]>([]);
  const familiesRef = useRef<string[]>([]);
  const depthRef = useRef(1);

  function softFallback() {
    return `${companionName} is here with you.`;
  }

  function send(raw: string) {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) return;
    if (text.length > MAX_LEN) {
      setLine("That was a lot — try a shorter thought.");
      return;
    }
    const now = Date.now();
    if (now - lastSentAt.current < MIN_GAP_MS) {
      setLine("I'm listening — one moment.");
      return;
    }
    lastSentAt.current = now;

    try {
      const voice = loadPersonality();
      const composed = buddyReplyToText({
        text,
        name: companionName,
        voice: voice === "chill" || voice === "playful" || voice === "warm" || voice === "mystical" || voice === "focused" ? voice : "warm",
        depth: depthRef.current,
        history: historyRef.current.slice(-6),
        families: familiesRef.current.slice(-8),
        seed: `talk:${now}`,
      });
      depthRef.current = Math.min(12, depthRef.current + 1);
      historyRef.current = [...historyRef.current, composed.text].slice(-8);
      if (composed.familyId) {
        familiesRef.current = [...familiesRef.current, composed.familyId].slice(-10);
      }
      setLine(composed.text);
      onReply?.(composed.text);
    } catch {
      const fallback = softFallback();
      setLine(fallback);
      onReply?.(fallback);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = draft;
    setDraft("");
    send(next);
  }

  return (
    <div className="mt-8 w-full text-left">
      {line ? (
        <p className="mb-3 text-sm leading-relaxed text-[#f4efe6]/90" aria-live="polite">
          {line}
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="flex gap-2">
        <label className="sr-only" htmlFor="buddie-talk">
          Talk with {companionName}
        </label>
        <input
          id="buddie-talk"
          type="text"
          value={draft}
          maxLength={MAX_LEN}
          autoComplete="off"
          placeholder={`Talk with ${companionName}…`}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-11 flex-1 rounded-full border border-white/12 bg-white/5 px-4 text-sm text-[#f4efe6] placeholder:text-white/30 outline-none focus:border-[#e8c4a0]/40"
        />
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-full border border-white/15 px-4 text-sm text-[#e8c4a0] transition hover:bg-white/5"
        >
          Send
        </button>
      </form>
    </div>
  );
}
