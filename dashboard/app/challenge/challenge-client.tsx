"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { buildChallengeReportPayload, renderChallengeReportPdf } from "@/lib/challenge-report-pdf";
import { CHALLENGE_SAMPLE_MOOD_COUNTS } from "@/lib/challenge-sample";

type LicenseOpt = { id: string; label: string };

export function ChallengeClient(props: { licenses: LicenseOpt[]; companionName: string }) {
  const { licenses, companionName } = props;
  const { status } = useSession();
  const [licenseId, setLicenseId] = useState(licenses[0]?.id || "");
  const [lastMood, setLastMood] = useState("chaotically optimistic");
  const [reportUrl, setReportUrl] = useState("");
  const [loadingReal, setLoadingReal] = useState(false);

  const challengeUrl = "https://buddieai.com/challenge";

  const shareText = useMemo(
    () =>
      `My AI buddy is feeling ${lastMood} this week! 😂 Get yours at ${challengeUrl} #BuddieAI #EmotionalIntelligence`,
    [challengeUrl, lastMood],
  );

  const encodedShare = useMemo(() => encodeURIComponent(shareText), [shareText]);

  const downloadSamplePdf = useCallback(async () => {
    const payload = buildChallengeReportPayload(CHALLENGE_SAMPLE_MOOD_COUNTS, "Sample Buddy");
    setLastMood(payload.headlineMood);
    const buf = await renderChallengeReportPdf(payload);
    const blob = new Blob([new Uint8Array(buf)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "buddy-challenge-sample.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const generateRealReport = useCallback(async () => {
    setLoadingReal(true);
    const query = licenseId ? `?licenseId=${encodeURIComponent(licenseId)}&mode=json` : "?mode=json";
    const res = await fetch(`/api/challenge/report${query}`, { method: "GET" });
    const data = (await res.json()) as { ok?: boolean; headlineMood?: string; downloadUrl?: string };
    if (res.ok && data.ok) {
      setLastMood(data.headlineMood || "mysteriously calm");
      setReportUrl(data.downloadUrl || "/api/challenge/report");
    }
    setLoadingReal(false);
  }, [licenseId]);

  return (
    <div className="space-y-12">
      <section className="glass-panel p-6 sm:p-10">
        <h2 className="text-xl font-semibold text-white">Example “Emotional Report Card”</h2>
        <p className="mt-2 text-sm text-slate-400">
          Fake data — but the real PDF uses your license&apos;s mood analytics. Humanize your AI, then roast it gently
          on the internet.
        </p>
        <div className="mt-6 grid gap-4 rounded-xl border border-white/10 bg-slate-950/50 p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Dominant vibe</p>
            <p className="mt-1 text-2xl font-semibold capitalize text-indigo-200">happy</p>
            <p className="mt-3 text-xs text-slate-500">Grade</p>
            <p className="text-lg text-emerald-300">A+ (Suspiciously well-adjusted)</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Buddy&apos;s advice</p>
            <p className="mt-1 text-sm text-slate-300">
              Celebrate small wins publicly. Your users can smell sincerity (and good metrics).
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">AI horoscope</p>
            <p className="mt-1 text-sm italic text-amber-100/90">
              The stars align with your changelog: Jupiter is in retrograde, but your deploy went green anyway.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void downloadSamplePdf()}
          className="mt-6 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Download sample PDF
        </button>
      </section>

      <section className="glass-panel p-6 sm:p-10">
        <h2 className="text-xl font-semibold text-white">Generate your real report</h2>
        <p className="mt-2 text-sm text-slate-400">
          Log in, pick a license tied to your Buddy embed, and we&apos;ll compile the last 7 days of mood signals into
          a colourful Buddy AI PDF.
        </p>
        {status !== "authenticated" ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm text-white hover:bg-indigo-500">
              Get a free license
            </Link>
            <Link href="/login" className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-slate-100 hover:bg-white/10">
              Login
            </Link>
          </div>
        ) : licenses.length === 0 ? (
          <p className="mt-4 text-sm text-amber-200">
            No licenses yet —{" "}
            <Link href="/dashboard" className="underline">
              open your dashboard
            </Link>{" "}
            to generate a Buddy key.
          </p>
        ) : (
          <div className="mt-6 flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              License
              <select
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                value={licenseId}
                onChange={(e) => setLicenseId(e.target.value)}
              >
                {licenses.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void generateRealReport()}
              disabled={loadingReal}
              className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {loadingReal ? "Generating..." : "Generate my report"}
            </button>
          </div>
        )}

        {reportUrl ? (
          <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
            <p className="text-sm text-emerald-100">Your report is ready. Current mood: {lastMood}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={reportUrl}
                className="inline-flex rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Download report PDF
              </a>
              <a
                className="rounded-full border border-white/20 px-4 py-2 text-xs text-white hover:bg-white/10"
                href={`https://twitter.com/intent/tweet?text=${encodedShare}`}
                target="_blank"
                rel="noreferrer"
              >
                Share on X
              </a>
              <a
                className="rounded-full border border-white/20 px-4 py-2 text-xs text-white hover:bg-white/10"
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(challengeUrl)}`}
                target="_blank"
                rel="noreferrer"
              >
                Share on LinkedIn
              </a>
            </div>
          </div>
        ) : null}
      </section>

      <section className="glass-panel p-6 sm:p-10">
        <h2 className="text-xl font-semibold text-white">Share the chaos</h2>
        <p className="mt-2 text-sm text-slate-400">
          Pre-filled post (updates when you generate a sample). Emotional intelligence has never been this meme-ready.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-300">
          {shareText}
        </pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-white hover:bg-white/10"
            href={`https://twitter.com/intent/tweet?text=${encodedShare}`}
            target="_blank"
            rel="noreferrer"
          >
            Share on X
          </a>
          <a
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-white hover:bg-white/10"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(challengeUrl)}`}
            target="_blank"
            rel="noreferrer"
          >
            Facebook
          </a>
          <a
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-white hover:bg-white/10"
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(challengeUrl)}`}
            target="_blank"
            rel="noreferrer"
          >
            LinkedIn
          </a>
        </div>
      </section>

      <p className="text-center text-xs text-slate-500">
        Signed-in companion name for real reports: <span className="text-indigo-200">{companionName}</span>
      </p>
    </div>
  );
}
