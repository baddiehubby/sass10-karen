import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "EU AI Act Compliance – The Emotional Safety Layer",
  description: "How Buddy AI helps your AI chat meet new EU AI Act requirements and protect users.",
  alternates: { canonical: "/eu-ai-act" },
};

const mapping = [
  {
    article: "Article 52",
    requirement: "Transparency obligations",
    buddy: "Mood log + visible emotional trace for AI responses",
    href: "/dashboard/analytics",
    label: "Open analytics",
  },
  {
    article: "Article 14",
    requirement: "Human oversight",
    buddy: "Live sentiment alerts routed to human reviewers",
    href: "/dashboard/alerts",
    label: "Open alerts",
  },
  {
    article: "Article 9",
    requirement: "Risk management",
    buddy: "Real-time concern detection and escalation monitoring",
    href: "/dashboard/audit-log",
    label: "Open audit log",
  },
  {
    article: "Article 15",
    requirement: "Accuracy and robustness",
    buddy: "EU supporting report + DPIA export package",
    href: "/dashboard",
    label: "Open compliance actions",
  },
];

export default function EuAiActPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-14">
      <article className="glass-panel p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddie AI · compliance</p>
        <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
          EU AI Act Compliance – The Emotional Safety Layer
        </h1>
        <p className="mt-4 max-w-3xl text-sm text-slate-300 sm:text-base">
          How Buddy AI helps your AI chat meet the new regulations and protect users.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white">What the EU AI Act requires</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li>Transparency about AI-generated interactions and impacts.</li>
            <li>Continuous risk monitoring for harmful or unsafe outcomes.</li>
            <li>Human oversight mechanisms for review and intervention.</li>
            <li>Emotional safety protections for vulnerable users and high-impact contexts.</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white">How Buddy AI directly addresses each requirement</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li>
              <span className="font-semibold text-indigo-200">Transparency →</span> Mood audit trail per conversation.
            </li>
            <li>
              <span className="font-semibold text-indigo-200">Risk monitoring →</span> Real-time sentiment alerts.
            </li>
            <li>
              <span className="font-semibold text-indigo-200">Human oversight →</span> Emotional dashboard for human reviewers.
            </li>
            <li>
              <span className="font-semibold text-indigo-200">Safety →</span> Detects frustration, anger, and sadness before escalation.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white">EU AI Act articles mapped to Buddy features</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/70 text-slate-200">
                <tr>
                  <th className="px-4 py-3">EU AI Act Article</th>
                  <th className="px-4 py-3">Regulatory Focus</th>
                  <th className="px-4 py-3">Buddy AI Feature</th>
                  <th className="px-4 py-3">Product Link</th>
                </tr>
              </thead>
              <tbody>
                {mapping.map((row) => (
                  <tr key={row.article} className="border-t border-slate-800 text-slate-300">
                    <td className="px-4 py-3 font-semibold text-indigo-200">{row.article}</td>
                    <td className="px-4 py-3">{row.requirement}</td>
                    <td className="px-4 py-3">{row.buddy}</td>
                    <td className="px-4 py-3">
                      <Link href={row.href} className="text-indigo-300 underline underline-offset-4 hover:text-indigo-200">
                        {row.label}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-indigo-400/25 bg-indigo-500/10 p-5">
          <h2 className="text-xl font-semibold text-white">White paper</h2>
          <p className="mt-2 text-sm text-slate-300">
            Download: <span className="font-semibold text-indigo-200">Emotional Safety for AI Chat in the EU</span>
          </p>
          <a href="/eu-ai-act-whitepaper.pdf" className="mt-3 inline-block text-sm text-indigo-200 underline">
            Download sample PDF
          </a>
        </section>

        <p className="mt-8 text-xs text-slate-400">
          Buddy AI assists with compliance; full conformity is the provider&apos;s responsibility.
        </p>

        <div className="mt-10">
          <Link
            href="/register"
            className="inline-flex rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Make your AI compliant – Get Buddy AI
          </Link>
        </div>
      </article>
    </main>
  );
}
