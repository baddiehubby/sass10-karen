"use client";

import Link from "next/link";
import confetti from "canvas-confetti";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

const personalities = [
  {
    id: "cheerful",
    title: "Cheerful",
    mood: "happy",
    desc: "Brightens fast — leans happy & excited when users sound upbeat. Great for creators and community products.",
  },
  {
    id: "calm",
    title: "Calm",
    mood: "neutral",
    desc: "Steady and reassuring — neutral and thoughtful first, so emotional intelligence feels professional, not noisy.",
  },
  {
    id: "genius",
    title: "Genius",
    mood: "thinking",
    desc: "Curious analyst — shows thinking when the AI goes deep; ideal when you humanize your AI for complex workflows.",
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [personality, setPersonality] = useState<(typeof personalities)[number]["id"]>("calm");
  const [embedKey, setEmbedKey] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/onboarding/bootstrap");
      if (!res.ok) return;
      const data = (await res.json()) as {
        companionName?: string;
        personality?: string;
        embedKey?: string;
        onboardingCompleted?: boolean;
      };
      if (!mounted) return;
      if (data.onboardingCompleted) {
        router.replace("/dashboard?celebrate=1");
        return;
      }
      setName(data.companionName || "");
      if (data.personality === "cheerful" || data.personality === "calm" || data.personality === "genius") {
        setPersonality(data.personality);
      }
      setEmbedKey(data.embedKey || "");
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const embedCode = useMemo(() => {
    const key = embedKey || "YOUR_LICENSE_KEY";
    return `<script src="/widget/livingface-widget.js" data-hq-key="${key}" async></script>`;
  }, [embedKey]);

  async function complete() {
    setLoading(true);
    const res = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companionName: name, personality }),
    });
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not complete onboarding");
      return;
    }
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.65 } });
    toast.success("Your Buddy is alive! He's already listening.");
    router.push("/dashboard?celebrate=1");
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddy AI · emotional intelligence</p>
      <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Wake up your Buddy</h1>
      <p className="mt-3 text-sm text-slate-400">
        Humanize your AI in three steps — your Buddy becomes the emotional intelligence layer users see, while your
        dashboard captures how they feel.
      </p>

      <div className="mt-8 glass-panel p-6">
        <div className="mb-6 text-xs text-slate-400">Step {step} of 3</div>

        {step === 1 ? (
          <section>
            <h2 className="text-xl font-semibold text-white">Name your Buddy</h2>
            <p className="mt-2 text-sm text-slate-400">Pick a name users will sense behind the orb — Orion, Luna, Buddy…</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Orion, Luna, Buddy"
              className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white"
            />
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <h2 className="text-xl font-semibold text-white">Pick his personality</h2>
            <p className="mt-2 text-sm text-slate-400">Each style nudges how your Buddy leans when he reads the chat.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {personalities.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersonality(p.id)}
                  className={`rounded-xl border p-4 text-left ${personality === p.id ? "border-indigo-400 bg-indigo-500/15" : "border-white/10 bg-white/5"}`}
                >
                  <div className={`orb-preview mood-${p.mood}`} />
                  <h3 className="mt-3 text-lg font-medium text-white">{p.title}</h3>
                  <p className="mt-1 text-sm text-slate-300">{p.desc}</p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section>
            <h2 className="text-xl font-semibold text-white">Your Buddy&apos;s home</h2>
            <p className="mt-2 text-sm text-slate-300">
              Paste this and your Buddy will start understanding your users immediately — emotional intelligence begins
              with one script tag.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-200">
              <code>{embedCode}</code>
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(embedCode).then(() => toast.success("Embed code copied"));
                }}
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500"
              >
                Copy code
              </button>
              <Link href="/demo" className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-100 hover:bg-white/10">
                See it in action
              </Link>
            </div>
          </section>
        ) : null}

        <div className="mt-8 flex justify-between">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-100 hover:bg-white/10 disabled:opacity-40"
          >
            Back
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              disabled={step === 1 && !name.trim()}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={complete}
              disabled={loading}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {loading ? "Finishing..." : "Complete onboarding"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
