import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Promise",
  description: "How Buddie AI protects your data with private-by-default design and encrypted infrastructure.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-14">
      <article className="glass-panel p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddie AI · privacy promise</p>
        <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">100% Private by Design</h1>
        <p className="mt-4 text-sm text-slate-300">
          Effective date: {new Date().toLocaleDateString()}. Buddie AI is built to feel like a premium companion while
          respecting your privacy at every step.
        </p>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">What stays private</h2>
          <p>
            Your raw conversation content is not stored as chat transcripts by default. Buddy reads emotional signals
            in context to animate your companion, then keeps only minimal operational data needed to run your account.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">Encryption and protection</h2>
          <p>
            Account sessions, billing webhooks, and dashboard APIs are served over HTTPS. Sensitive account flows are
            signed, verified, and protected by server-side controls. Access is scoped to your account and license.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">How we handle telemetry</h2>
          <p>
            We process minimal telemetry such as license usage, mood events, and stability signals to keep Buddy
            reliable. We do not sell personal data and we do not run ad-tracking based profiling.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">Third-party services</h2>
          <p>
            We use trusted providers such as Google OAuth for login and Lemon Squeezy for billing. They only receive
            the data required for those specific services under their own compliance obligations.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">Your control</h2>
          <p>
            You can request export or deletion of account data and revoke access at any time. If you uninstall Buddy
            or remove your license, active companion behavior stops immediately.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">Contact</h2>
          <p>
            Questions or requests:{" "}
            <a className="text-indigo-300 underline" href="mailto:privacy@buddieai.com">
              privacy@buddieai.com
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
