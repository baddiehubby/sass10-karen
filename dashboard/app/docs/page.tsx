import Link from "next/link";
import { readFile } from "fs/promises";
import path from "path";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developer Docs",
  description: "Buddie AI API and widget embed docs for integrations and verification endpoints.",
  alternates: { canonical: "/docs" },
};

export default async function DocsPage() {
  let content = "";
  try {
    content = await readFile(path.join(process.cwd(), "docs", "api-docs.md"), "utf8");
  } catch {
    content = "Documentation file not found. Expected dashboard/docs/api-docs.md";
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddy AI · developers</p>
      <h1 className="mt-4 text-3xl font-semibold text-white">API &amp; embed documentation</h1>
      <p className="mt-3 text-sm text-slate-400">
        Humanize your AI with one script tag — wire emotional intelligence analytics through the same origin you deploy
        on.
      </p>
      <div className="mt-8 glass-panel p-6">
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-300">
          {content}
        </pre>
      </div>
      <p className="mt-8 text-center text-sm text-slate-500">
        <Link href="/integrations" className="text-indigo-300 hover:underline">
          ← Integrations directory
        </Link>
      </p>
    </main>
  );
}
