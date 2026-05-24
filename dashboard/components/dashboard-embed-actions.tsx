"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { CHROME_WEB_STORE_URL } from "@/lib/marketing-links";
import { CopyEmbedCodeButton } from "@/components/copy-embed-code-button";

type DashboardEmbedActionsProps = {
  embedCode: string;
  hasLicense: boolean;
};

export function DashboardEmbedActions({ embedCode, hasLicense }: DashboardEmbedActionsProps) {
  const [showCode, setShowCode] = useState(false);

  async function copyCode() {
    if (!embedCode) {
      toast.error("Get a license first from Pricing.");
      return;
    }
    try {
      await navigator.clipboard.writeText(embedCode);
      toast.success("Embed code copied");
    } catch {
      toast.error("Copy failed — use the button below");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/integrations"
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500"
        >
          Add to WordPress
        </Link>
        <a
          href={CHROME_WEB_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 hover:bg-violet-500"
        >
          Add to Chrome
        </a>
        <button
          type="button"
          onClick={() => void copyCode()}
          disabled={!hasLicense}
          className="rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-40"
        >
          Copy Embed Code
        </button>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/integrations" className="text-indigo-300 hover:text-indigo-200 hover:underline">
          Install WordPress Plugin →
        </Link>
        <a
          href={CHROME_WEB_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-300 hover:text-indigo-200 hover:underline"
        >
          Add Chrome Extension →
        </a>
        <button
          type="button"
          onClick={() => setShowCode((v) => !v)}
          className="text-slate-400 hover:text-slate-200"
        >
          {showCode ? "Hide" : "Show"} embed snippet
        </button>
      </div>

      {showCode && embedCode ? (
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-300">
          <code>{embedCode}</code>
        </pre>
      ) : null}

      {hasLicense ? (
        <div className="opacity-80">
          <CopyEmbedCodeButton embedCode={embedCode} />
        </div>
      ) : null}
    </div>
  );
}
