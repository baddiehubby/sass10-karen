import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Scale, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Trust Center",
  description: "EU AI Act compliance tools, compliance reports, and enterprise trust resources for Buddie AI.",
  alternates: { canonical: "/trust-center" },
};

const resources = [
  {
    icon: Scale,
    title: "EU AI Act tools",
    description: "Article mapping, transparency requirements, and regulatory guidance for your AI chat.",
    href: "/eu-ai-act",
    label: "Open EU AI Act hub",
  },
  {
    icon: Shield,
    title: "GDPR & privacy",
    description: "Data handling, DPIA exports, and privacy controls for emotional telemetry.",
    href: "/gdpr",
    label: "View GDPR resources",
  },
  {
    icon: FileText,
    title: "Compliance reports",
    description: "Generate audit-ready compliance reports and export packages from your dashboard.",
    href: "/dashboard",
    label: "Open dashboard",
  },
];

export default function TrustCenterPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-14">
      <article className="glass-panel p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-300/90">Buddie AI · Trust Center</p>
        <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
          Enterprise compliance &amp; trust tools
        </h1>
        <p className="mt-4 max-w-3xl text-sm text-slate-300 sm:text-base">
          Your AI companion keeps you safe day to day. When you need formal compliance — EU AI Act alignment,
          GDPR documentation, and audit-ready reports — everything lives here.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {resources.map((item) => (
            <div key={item.title} className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <item.icon className="mb-4 h-8 w-8 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{item.description}</p>
              <Link
                href={item.href}
                className="mt-4 inline-block text-sm font-medium text-amber-300 hover:text-amber-200"
              >
                {item.label} →
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-slate-400">
          Need custom compliance workflows or on-premise deployment?{" "}
          <a href="mailto:hello@buddieai.com" className="text-amber-300 hover:text-amber-200">
            Contact us
          </a>{" "}
          for enterprise compliance tools.
        </p>
      </article>
    </main>
  );
}
