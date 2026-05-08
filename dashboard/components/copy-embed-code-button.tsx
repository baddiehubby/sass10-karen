"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

export function CopyEmbedCodeButton({ embedCode }: { embedCode: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      toast.success("Embed code copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Clipboard unavailable. Copy manually.");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500"
    >
      {copied ? "Copied" : "Copy Embed Code"}
    </button>
  );
}
