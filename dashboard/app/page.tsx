import type { Metadata } from "next";
import Link from "next/link";
import { LuxuryHomeEffects } from "@/components/luxury-home-effects";

export const metadata: Metadata = {
  title: "Buddie AI – The Emotional Safety Layer for AI Chat (EU AI Act Ready)",
  description:
    "Protect your users and comply with the EU AI Act. Buddy AI adds emotional intelligence to any chatbot – detect harm, monitor sentiment, and build trust. Embed in 30 seconds.",
  alternates: { canonical: "/" },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Buddie AI",
  url: "https://buddieai.com",
  sameAs: ["https://x.com/buddieai", "https://www.linkedin.com/company/buddieai"],
};

export default function Home() {
  return (
    <main className="home-luxury-bg mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-10">
      <section data-reveal className="flex flex-col items-center text-center reveal">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
        <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddy AI · emotional safety layer</p>
        <h1 className="luxury-headline mt-5 max-w-5xl text-4xl font-semibold tracking-tight sm:text-6xl">
          AI Hallucinates. Buddy Feels. The EU Is Watching.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300 sm:text-xl">
          Every AI chat is missing an emotional safety layer. Without it, your chatbot is a liability. Buddy AI reads
          emotions, prevents harm, and keeps you compliant with the EU AI Act. Embed in 30 seconds. Trusted by pioneers
          worldwide.
        </p>

        <div className="luxury-glass mt-12 w-full max-w-5xl rounded-3xl p-6 sm:p-10">
          <LuxuryHomeEffects />
          <p className="buddy-type-line mt-8 justify-center text-center">
            <span className="cursor-blink typing-line" />
          </p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="luxury-btn rounded-full px-7 py-3 text-sm font-semibold text-white"
          >
            Get Compliant Now – Free
          </Link>
          <Link
            href="/demo"
            className="luxury-btn-secondary rounded-full px-7 py-3 text-sm font-medium text-white"
          >
            See It in Action
          </Link>
        </div>
      </section>

      <section data-reveal className="mt-24 reveal">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">Why AI Chat Needs Emotional Intelligence</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-400">
          The AI race is now a safety race. Emotional blindness creates risk, complaints, and regulatory pressure.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <article className="luxury-card glass-panel p-6 text-left">
            <div className="feature-animated-icon icon-lock" />
            <h3 className="mt-4 text-lg font-semibold text-white">Prevent Hallucination Damage</h3>
            <p className="mt-2 text-sm text-slate-300">
              When AI confidently says something wrong, users feel frustrated. Buddy detects that in real time and alerts
              you before a complaint.
            </p>
          </article>
          <article className="luxury-card glass-panel p-6 text-left">
            <div className="feature-animated-icon icon-heart" />
            <h3 className="mt-4 text-lg font-semibold text-white">EU AI Act Compliance</h3>
            <p className="mt-2 text-sm text-slate-300">
              The EU requires AI systems to be transparent, safe, and human-centric. Buddy&apos;s emotional audit trail
              proves your chatbot cares.
            </p>
          </article>
          <article className="luxury-card glass-panel p-6 text-left">
            <div className="feature-animated-icon icon-shield" />
            <h3 className="mt-4 text-lg font-semibold text-white">Trust = Retention</h3>
            <p className="mt-2 text-sm text-slate-300">
              Users who feel understood stay 3x longer. Emotional analytics turns your chatbot from a robot into a
              trusted teammate.
            </p>
          </article>
        </div>
      </section>

      <section data-reveal className="mt-24 reveal">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">How It Works – 3 Steps</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-400">
          The fastest route from risky chatbot to compliant emotional safety system.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <article className="luxury-card glass-panel p-6">
            <div className="line-illustration">
              <span />
              <span />
              <span />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">Embed in 30 seconds</h3>
            <p className="mt-2 text-sm text-slate-300">One line of code puts Buddy in every AI conversation.</p>
          </article>
          <article className="luxury-card glass-panel p-6">
            <div className="line-illustration">
              <span />
              <span />
              <span />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">Buddy reads every conversation</h3>
            <p className="mt-2 text-sm text-slate-300">An emotional sensor tracks shifts in trust, confusion, and concern.</p>
          </article>
          <article className="luxury-card glass-panel p-6">
            <div className="line-illustration">
              <span />
              <span />
              <span />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">Your dashboard lights up</h3>
            <p className="mt-2 text-sm text-slate-300">Sentiment scores, alerts, and EU-ready reports appear in real time.</p>
          </article>
        </div>
      </section>

      <section data-reveal className="eu-act-panel reveal mt-24 rounded-3xl border border-indigo-400/30 px-6 py-12 sm:px-10">
        <div className="eu-stars" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">The EU AI Act Is Here – Are You Ready?</h2>
        <p className="mx-auto mt-5 max-w-4xl text-center text-sm leading-relaxed text-slate-200 sm:text-base">
          The EU AI Act requires providers of AI systems to monitor emotional impact and ensure transparency. Every AI
          chatbot you deploy without emotional oversight is a ticking time bomb of non-compliance. Buddy AI gives you a
          real-time emotional audit trail and safety alerts. It&apos;s not a luxury — it&apos;s the new standard.
        </p>
        <div className="mt-7 text-center">
          <Link href="/eu-ai-act" className="text-indigo-200 underline underline-offset-4 hover:text-indigo-100">
            Explore the EU AI Act guide
          </Link>
        </div>
      </section>

      <section data-reveal className="mt-24 reveal">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">What leaders say</h2>
        <div className="testimonial-carousel mt-8">
          <div className="testimonial-track">
            <article className="testimonial-card">“Buddy made compliance conversations with our legal team instantly easier.”</article>
            <article className="testimonial-card">“The alerts + audit log created the human oversight trail we were missing.”</article>
            <article className="testimonial-card">“Users stayed calmer when we started monitoring emotional drift in chat.”</article>
            <article className="testimonial-card">“The compliance report gave us executive-level clarity in one click.”</article>
            <article className="testimonial-card">“Buddy made compliance conversations with our legal team instantly easier.”</article>
            <article className="testimonial-card">“The alerts + audit log created the human oversight trail we were missing.”</article>
            <article className="testimonial-card">“Users stayed calmer when we started monitoring emotional drift in chat.”</article>
            <article className="testimonial-card">“The compliance report gave us executive-level clarity in one click.”</article>
          </div>
        </div>
      </section>

      <section data-reveal className="mt-24 rounded-2xl border border-indigo-500/25 bg-indigo-950/25 px-6 py-14 text-center backdrop-blur-md reveal">
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">
          Make emotional safety your AI default.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-300">
          Ship chat that feels safer, proves oversight, and stays ahead of regulation.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="luxury-btn-light rounded-full px-6 py-3 text-sm font-semibold text-slate-900"
          >
            Get Compliant Now – Free
          </Link>
          <Link
            href="/demo"
            className="luxury-btn-secondary rounded-full px-6 py-3 text-sm font-medium text-white"
          >
            See It in Action
          </Link>
        </div>
      </section>

      <footer data-reveal className="footer-premium mt-20 border-t border-white/10 pt-8 text-sm text-slate-400 reveal">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Buddy AI. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="text-slate-500">Compliance:</span>
            <Link href="/eu-ai-act" className="hover:text-white">
              EU AI Act
            </Link>
            <Link href="/gdpr" className="hover:text-white">
              GDPR
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
