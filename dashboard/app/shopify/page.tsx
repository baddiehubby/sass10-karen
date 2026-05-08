import Link from "next/link";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Shopify Integration",
  description: "Install Buddie AI on Shopify in minutes and collect emotional intelligence signals from shoppers.",
  alternates: { canonical: "/shopify" },
};

export default async function ShopifyPage() {
  const session = await getServerSession(authOptions);
  const authed = Boolean(session?.user?.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddy AI · Shopify</p>
      <h1 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">Add Buddy AI to your Shopify store</h1>
      <p className="mt-4 text-slate-300">
        Humanize your AI on storefront chat, support widgets, or headless experiences — same luxury Buddy orb, same
        emotional intelligence analytics in your Buddy AI dashboard.
      </p>

      <ol className="mt-10 space-y-6 text-slate-200">
        <li className="glass-panel p-5">
          <p className="text-sm font-semibold text-indigo-200">Step 1</p>
          <p className="mt-1 text-white">Copy your Buddy AI license key from the dashboard.</p>
          {!authed ? (
            <Link href="/register" className="mt-3 inline-block text-sm text-indigo-300 hover:underline">
              Get a free license →
            </Link>
          ) : (
            <Link href="/dashboard" className="mt-3 inline-block text-sm text-indigo-300 hover:underline">
              Open dashboard →
            </Link>
          )}
        </li>
        <li className="glass-panel p-5">
          <p className="text-sm font-semibold text-indigo-200">Step 2</p>
          <p className="mt-1 text-white">
            In Shopify Admin go to <strong>Online Store</strong> → <strong>Themes</strong> → <strong>Edit code</strong> →{" "}
            <code className="rounded bg-slate-950/80 px-1 font-mono text-indigo-200">theme.liquid</code>.
          </p>
        </li>
        <li className="glass-panel p-5">
          <p className="text-sm font-semibold text-indigo-200">Step 3</p>
          <p className="mt-1 text-white">
            Paste this snippet just before <code className="font-mono text-indigo-200">&lt;/body&gt;</code>, replacing{" "}
            <code className="font-mono">YOUR_LICENSE_KEY</code> and <code className="font-mono">YOUR_BUDDY_APP_URL</code>{" "}
            with your values:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-300">
            <code>{`<script src="YOUR_BUDDY_APP_URL/widget/livingface-widget.js"
  data-hq-key="YOUR_LICENSE_KEY"
  data-hq-api="YOUR_BUDDY_APP_URL"
  async></script>`}</code>
          </pre>
        </li>
      </ol>

      <section className="mt-12 flex flex-col items-center glass-panel p-10">
        <p className="text-xs uppercase tracking-wide text-slate-500">Live orb preview</p>
        <div
          className="mt-6 h-28 w-28 rounded-full shadow-[0_0_40px_rgba(99,102,241,0.55)]"
          style={{
            background: "radial-gradient(circle at 30% 22%, #e2e8f0 0%, #6366f1 42%, #1e1b4b 100%)",
            animation: "orbFloat 3.6s ease-in-out infinite",
          }}
        />
        <p className="mt-6 max-w-md text-center text-sm text-slate-400">
          This is a static preview — the real Buddy listens to your AI output and reacts with emotional intelligence.
        </p>
      </section>
    </main>
  );
}
