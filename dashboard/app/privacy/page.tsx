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
          <h2 className="text-lg font-semibold text-white">How we use your emotional data</h2>
          <p>
            Buddie AI reads emotional tone <strong className="font-medium text-white">on your device</strong> to animate
            your companion. We never upload your chat transcripts. If you opt in, we may store:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Mood labels (e.g. happy, concerned) and timestamps</li>
            <li>Irreversibly hashed session identifiers — not your name or email in the anonymized layer</li>
            <li>Broad region buckets only (EU, US, Asia, Other)</li>
            <li>Which AI platform you were on (ChatGPT, Claude, Gemini, or our website)</li>
          </ul>
          <p>
            You choose separately whether mood appears on your dashboard, whether anonymized analytics help improve
            Buddy, and whether mood sequences may be used for model training. Enterprise data licensing is off unless
            you explicitly enable it later in Settings.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">Emotional Intelligence Data Layer</h2>
          <p>
            Buddie AI offers <strong className="font-medium text-white">granular consent</strong> per purpose in your
            dashboard settings: companion mood on your account, anonymous product analytics, model training, and
            optional enterprise data licensing. Each choice is logged with timestamp for GDPR accountability.
          </p>
          <p>
            The anonymized layer stores only mood labels, UTC timestamps, irreversible hashed session tokens, broad
            region buckets (EU / US / Asia / Other), and AI platform source (ChatGPT, Claude, Gemini, etc.).{" "}
            <strong className="font-medium text-white">Raw conversation text never leaves your device.</strong>
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">AI disclosure (California SB 243)</h2>
          <p>
            Buddy is an AI companion — not a human. When the orb is active on AI chat sites, you are interacting with
            software that infers emotional tone locally to animate the companion. We provide clear in-widget notice
            before any optional anonymous analytics.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">Model training &amp; China 2026 rules</h2>
          <p>
            Training on interaction data requires a separate <strong className="font-medium text-white">model_training</strong>{" "}
            consent toggle. Sensitive chat content is never uploaded. Enterprise dataset sales require an additional{" "}
            <strong className="font-medium text-white">data_selling</strong> opt-in and export only k-anonymized
            aggregates.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">Minors</h2>
          <p>
            Buddie AI is not directed at children under 16. We do not knowingly process minors&apos; emotional data. If
            you believe a minor has created an account, contact us for deletion.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">How we handle telemetry</h2>
          <p>
            We process minimal telemetry such as license usage and mood labels to keep Buddy reliable. We do not run
            ad-tracking profiling. Optional anonymous analytics power product improvement only when you opt in.
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
            You can withdraw consent at any time in Settings (each purpose is independent). Deletion requests:
            email{" "}
            <a className="text-indigo-300 underline" href="mailto:privacy@buddieai.com">
              privacy@buddieai.com
            </a>
            . If you uninstall Buddy or remove your license, active companion behavior stops immediately.
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
