import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using Buddie AI, payment terms, embedding rights, and liability limits.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-14">
      <article className="glass-panel p-8 sm:p-10">
        <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddie AI · legal</p>
        <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Terms of Service</h1>
        <p className="mt-4 text-sm text-slate-300">By accessing Buddie AI, you agree to these terms.</p>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">Acceptance of terms</h2>
          <p>
            Your use of Buddie AI, including dashboard, widget, APIs, and integrations, constitutes acceptance of
            these Terms and our Privacy Policy.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">Service description</h2>
          <p>
            Buddie AI provides an emotional intelligence layer for AI chat, including mood sensing widget behavior,
            analytics views, reporting, and related developer tools.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">User obligations</h2>
          <p>
            You are responsible for lawful use, account security, and ensuring your deployments and user notices comply
            with local privacy laws. You must not misuse the service or attempt unauthorized access.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">Payment terms</h2>
          <p>
            Paid plans are billed via Lemon Squeezy subscriptions. Fees are due at checkout. Access to paid features may
            be suspended for failed payment or chargeback events.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">Intellectual property</h2>
          <p>
            Buddie AI retains ownership of the widget software, dashboards, marks, and platform IP. Customers receive a
            limited, revocable license to embed and use the widget under an active account.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">Limitation of liability</h2>
          <p>
            Buddie AI is provided on an as-is basis. To the maximum extent allowed by law, Buddie AI is not liable for
            indirect, incidental, special, or consequential damages arising from your use of the service.
          </p>
        </section>

        <section className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
          <h2 className="text-lg font-semibold text-white">Governing law</h2>
          <p>
            These terms are governed by applicable local law where the service operator is established, without regard
            to conflict of law rules.
          </p>
        </section>
      </article>
    </main>
  );
}
