"use client";

/**
 * Local companion talk — Soul Engine only, never blocks the product.
 * Tracks history/families/machine for anti-repetition + continuity.
 * Soft character fallback if intelligence throws.
 */

import { useRef, useState, type FormEvent } from "react";
import { buddyReplyFull } from "@/lib/buddy-intelligence";
import type { CompanionPersonality } from "@/lib/companion-mood";
import { loadPersonality } from "@/lib/mood-memory";
import { ABUSE_LIMITS } from "@/src/intelligence/cost";
import type { ConversationMachineState, ConversationTurn } from "@/src/intelligence";

const MAX_LEN = 800;
const MIN_GAP_MS = 650;

type CompanionTalkProps = {
  companionName: string;
  /** Server-seeded voice — same character on every device when provided. */
  voice?: CompanionPersonality;
  onReply?: (text: string) => void;
};

function resolveVoice(preferred?: CompanionPersonality): CompanionPersonality {
  if (
    preferred === "chill" ||
    preferred === "playful" ||
    preferred === "warm" ||
    preferred === "mystical" ||
    preferred === "focused"
  ) {
    return preferred;
  }
  const local = loadPersonality();
  return local === "chill" || local === "playful" || local === "warm" || local === "mystical" || local === "focused"
    ? local
    : "warm";
}

function softPresenceLine(companionName: string, seed: string, voice: CompanionPersonality): string {
  try {
    return buddyReplyFull({
      text: "just checking you're still here",
      name: companionName,
      voice,
      depth: 1,
      seed: `presence:${seed}`,
      persistMemories: false,
    }).text;
  } catch {
    return "I'm right here with you.";
  }
}

export function CompanionTalk({ companionName, voice: voiceProp, onReply }: CompanionTalkProps) {
  const [draft, setDraft] = useState("");
  const [line, setLine] = useState<string | null>(null);
  const lastSentAt = useRef(0);
  const historyRef = useRef<string[]>([]);
  const familiesRef = useRef<string[]>([]);
  const turnsRef = useRef<ConversationTurn[]>([]);
  const machineRef = useRef<ConversationMachineState | undefined>(undefined);
  const depthRef = useRef(1);
  const voice = resolveVoice(voiceProp);

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

    if (depthRef.current > ABUSE_LIMITS.MAX_DEPTH || turnsRef.current.length > ABUSE_LIMITS.MAX_TURNS) {
      setLine("Let's take a soft pause — start a fresh thread when you're ready.");
      return;
    }

    try {
      const composed = buddyReplyFull({
        text,
        name: companionName,
        voice,
        depth: depthRef.current,
        history: historyRef.current.slice(-8),
        families: familiesRef.current.slice(-10),
        recentTurns: turnsRef.current.slice(-8),
        previousMachine: machineRef.current,
        seed: `talk:${now}`,
        persistMemories: true,
        userScope: `session:talk:${companionName.slice(0, 24)}`,
      });
      depthRef.current = Math.min(12, depthRef.current + 1);
      historyRef.current = [...historyRef.current, composed.text].slice(-10);
      if (composed.familyId) {
        familiesRef.current = [...familiesRef.current, composed.familyId].slice(-12);
      }
      machineRef.current = composed.conversation;
      const userTurn: ConversationTurn = {
        role: "user",
        text,
        intent: composed.intent,
        at: new Date().toISOString(),
      };
      const buddyTurn: ConversationTurn = {
        role: "buddy",
        text: composed.text,
        intent: composed.intent,
        at: new Date().toISOString(),
      };
      turnsRef.current = [...turnsRef.current, userTurn, buddyTurn].slice(-12);
      setLine(composed.text);
      onReply?.(composed.text);
    } catch {
      const fallback = softPresenceLine(companionName, String(now), voice);
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
          enterKeyHint="send"
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
