"use client";

import Script from "next/script";

type BuddyOrbPreviewProps = {
  licenseKey: string | null;
  scriptUrl: string;
  apiBase: string;
};

export function BuddyOrbPreview({ licenseKey, scriptUrl, apiBase }: BuddyOrbPreviewProps) {
  if (!licenseKey) {
    return (
      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 via-violet-500/30 to-fuchsia-500/20 ring-2 ring-white/10">
        <span className="text-xs text-slate-400">No license</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <p className="mb-2 text-xs text-slate-500">Live preview — orb appears bottom-right on this page</p>
      <Script
        src={scriptUrl}
        data-hq-key={licenseKey}
        data-hq-api={apiBase}
        data-hq-css={`${apiBase.replace(/\/$/, "")}/widget/buddy-widget.css`}
        strategy="afterInteractive"
      />
      <div className="flex h-24 w-full items-center justify-center rounded-xl border border-dashed border-indigo-500/30 bg-indigo-500/5 text-sm text-indigo-200">
        Buddy orb active ↘
      </div>
    </div>
  );
}
