import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Embed Buddie AI on WordPress, Shopify, Wix, Squarespace, and custom stacks.",
  alternates: { canonical: "/integrations" },
};

const rows = [
  {
    name: "WordPress",
    desc: "Ship-ready plugin in the monorepo: license key, script base URL, corner position, admin preview orb.",
    href: "/docs",
    cta: "WordPress plugin",
  },
  {
    name: "Shopify",
    desc: "Paste one script into theme.liquid — works with Online Store 2.0 and classic themes.",
    href: "/shopify",
    cta: "Shopify guide",
  },
  {
    name: "Wix",
    desc: "Custom code → Body end: add the same script tag as custom HTML. Point data-hq-api at your Buddy AI host.",
    href: "/docs",
    cta: "Embed reference",
  },
  {
    name: "Squarespace",
    desc: "Code injection (Footer) — single script tag before closing body. Bind domain in Buddy dashboard if needed.",
    href: "/docs",
    cta: "Embed reference",
  },
  {
    name: "Custom HTML / any stack",
    desc: "One async script + data attributes. Works beside React, Vue, or static marketing sites.",
    href: "/docs",
    cta: "Snippet & verify API",
  },
  {
    name: "Developers",
    desc: "License verify, theme, analytics ingest — swap providers in one place later.",
    href: "/docs",
    cta: "API docs",
  },
];

export default function IntegrationsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14">
      <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddy AI · distribution</p>
      <h1 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">Buddy for every platform</h1>
      <p className="mt-4 max-w-3xl text-slate-300">
        One emotional intelligence layer — infinite surfaces. Humanize your AI wherever you already ship chat: follow
        the one-click style guides below and funnel signal back to your Buddy AI dashboard.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <article key={r.name} className="glass-panel p-6">
            <h2 className="text-lg font-semibold text-white">{r.name}</h2>
            <p className="mt-2 text-sm text-slate-400">{r.desc}</p>
            <Link href={r.href} className="mt-4 inline-flex text-sm font-medium text-indigo-300 hover:underline">
              {r.cta} →
            </Link>
          </article>
        ))}
      </div>

      <section className="mt-12 glass-panel p-6">
        <h2 className="text-lg font-semibold text-white">Default embed snippet</h2>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-300">
          <code>{`<script src="https://YOUR_DOMAIN/widget/livingface-widget.js"
  data-hq-key="YOUR_LICENSE_KEY"
  data-hq-api="https://YOUR_DOMAIN"
  async></script>`}</code>
        </pre>
      </section>
    </main>
  );
}
