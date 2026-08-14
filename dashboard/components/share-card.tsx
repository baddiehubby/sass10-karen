"use client";

import { useState } from "react";
import { shareCopy, type ShareKind } from "@/lib/buddy-universe";
import { trackUniverse } from "@/lib/universe-flags";

type ShareCardProps = {
  kind: ShareKind;
  title: string;
  line: string;
};

const KIND_LABEL: Record<ShareKind, string> = {
  vibe: "My Buddy Vibe",
  energy: "Today's Energy",
  oracle: "My Oracle",
  constellation: "My Mood Constellation",
  week: "7 Days with Buddy",
  milestone: "Buddy Milestone",
};

export function ShareCard({ kind, title, line }: ShareCardProps) {
  const [copied, setCopied] = useState(false);
  const text = shareCopy(kind, { title, line });

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: KIND_LABEL[kind], text });
        trackUniverse("buddy_share", { kind });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      trackUniverse("buddy_share", { kind });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        trackUniverse("buddy_share", { kind });
      } catch {
        setCopied(false);
      }
    }
  }

  return (
    <article className={`share-card share-card-${kind}`}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">{KIND_LABEL[kind]}</p>
      <p className="mt-2 text-xl font-light text-white">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-white/70">{line}</p>
      <button
        type="button"
        onClick={() => void share()}
        className="mt-4 min-h-11 rounded-full border border-white/15 px-4 text-xs text-white/60 hover:border-white/30 hover:text-white/80"
      >
        {copied ? "Copied" : "Share this card"}
      </button>
      <p className="mt-2 text-[10px] text-white/25">Optional. Private notes stay private.</p>
    </article>
  );
}
