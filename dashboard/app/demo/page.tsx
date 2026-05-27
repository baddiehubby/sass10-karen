"use client";

import Script from "next/script";
import Link from "next/link";
import { useMemo, useState } from "react";
import { detectMoodFromText } from "@/lib/mood-detection";
import { getPublicAppBaseUrl } from "@/lib/site-url";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

const DEMO_LICENSE_KEY = "DEMO-FREE-LICENSE";
const DEMO_API_ORIGIN = getPublicAppBaseUrl();

const SIMULATED_REPLIES = [
  "Try the Buddy that is making AI safe for the EU. We log emotional signals to strengthen transparency and oversight.",
  "Great question. Buddy tracks emotional tone from AI replies and turns it into a timeline so your team can spot friction quickly.",
  "If you need implementation details, I can explain the embed script, license verification flow, and analytics event pipeline.",
  "Amazing momentum. For beta users, keep the first-run setup simple: generate key, copy script, embed, then watch analytics light up.",
  "When users ask for help or say something is broken, Buddy shifts to concerned mood so teams can respond before churn starts.",
];

export default function DemoPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hello! I am your Buddy beta guide. Try the Buddy that is making AI safe for the EU.",
    },
    {
      role: "assistant",
      text: "Ask about the EU AI Act, emotional safety, licensing, embed code, analytics, or how this demo works.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const demoScript = useMemo(() => {
    return `<script src="/widget/livingface-widget.js" data-hq-key="${DEMO_LICENSE_KEY}" data-hq-api="${DEMO_API_ORIGIN}" async></script>`;
  }, []);

  const lastAssistantMessage =
    [...messages].reverse().find((message) => message.role === "assistant")?.text ||
    "Buddy demo ready. Ask a question to see a mood update.";
  const inferredMood = detectMoodFromText(lastAssistantMessage, "neutral");

  function generateReply(userPrompt: string): string {
    const lowered = userPrompt.toLowerCase();
    if (lowered.includes("pricing") || lowered.includes("pro") || lowered.includes("agency")) {
      return "Pro adds advanced analytics history, and Agency adds team sync plus white-label controls for client deployments.";
    }
    if (lowered.includes("embed") || lowered.includes("script") || lowered.includes("install")) {
      return `Copy your script tag with a valid license key and paste it before </body>. Buddy appears in the corner and starts reacting instantly.`;
    }
    if (lowered.includes("analytics") || lowered.includes("dashboard")) {
      return "Analytics captures mood events in real time and surfaces trends, top words, and concern spikes so you can improve user experience.";
    }
    if (lowered.includes("eu") || lowered.includes("act") || lowered.includes("compliance") || lowered.includes("law")) {
      return "The EU AI Act raises the bar for transparency and human-centric safety. Buddy helps by creating a real-time emotional audit trail.";
    }
    if (lowered.includes("party") || lowered.includes("love") || lowered.includes("secret")) {
      return "Amazing energy. Buddy noticed your vibe and shifted mood in real time. Easter egg accepted.";
    }
    return SIMULATED_REPLIES[Math.floor(Math.random() * SIMULATED_REPLIES.length)]!;
  }

  async function send() {
    const text = input.trim();
    if (!text || isThinking) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    const lowered = text.toLowerCase();
    if (lowered.includes("party") || lowered.includes("love") || lowered.includes("custom theme") || lowered.includes("excited")) {
      setShowUpgrade(true);
    }
    setInput("");
    setIsThinking(true);
    const waitMs = 1000 + Math.floor(Math.random() * 1000);
    await new Promise((resolve) => window.setTimeout(resolve, waitMs));
    setMessages((prev) => [...prev, { role: "assistant", text: generateReply(text) }]);
    setIsThinking(false);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14">
      <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddy AI · emotional intelligence</p>
      <h1 className="mt-3 text-3xl font-semibold text-white sm:text-5xl">See your Buddy react in real time</h1>
      <p className="mt-4 max-w-3xl text-slate-300">
        Try the Buddy that&apos;s making AI safe for the EU. This demo simulates AI chat while running the same embed
        customers use — then opens emotional intelligence analytics your team can ship against.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="glass-panel p-5">
          <h2 className="text-sm font-semibold text-white">Simulated AI chat</h2>
          <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            {messages.map((message, idx) => (
              <div
                key={`${message.role}-${idx}`}
                data-message-author-role={message.role === "assistant" ? "assistant" : undefined}
                className={
                  message.role === "assistant"
                    ? "rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-3 text-sm text-slate-100"
                    : "rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-300"
                }
              >
                <p className="font-medium text-indigo-200">{message.role === "assistant" ? "Assistant" : "User"}</p>
                <p>{message.text}</p>
              </div>
            ))}
            {isThinking ? (
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-400">
                <p className="font-medium text-indigo-200">Assistant</p>
                <p>Thinking...</p>
              </div>
            ) : null}
            <div className="mt-2 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void send();
                }}
                placeholder="Type a prompt to test the Buddy widget..."
                className="w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-white"
              />
              <button
                onClick={() => void send()}
                disabled={isThinking}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isThinking ? "..." : "Send"}
              </button>
            </div>
            {showUpgrade ? (
              <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 p-3 text-sm text-amber-200">
                Unlock the full emotional intelligence stack — go Pro.{" "}
                <Link href="/pricing" className="underline">
                  View pricing
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="glass-panel p-5">
          <h2 className="text-sm font-semibold text-white">Embed snippet</h2>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-300">
            <code>{demoScript}</code>
          </pre>
          <p className="mt-3 text-xs text-slate-400">
            Last assistant mood detection: <span className="font-semibold capitalize text-indigo-200">{inferredMood}</span>
          </p>
          <p className="mt-4 text-sm text-slate-300">
            This page loads <code className="font-mono text-indigo-200">/widget/livingface-widget.js</code> so visitors
            feel Buddy AI before they sign up — emotional intelligence you can try in seconds.
          </p>
        </aside>
      </div>

      <div className="pointer-events-none fixed -left-[10000px] top-0 w-[320px] opacity-[0.01]" aria-hidden>
        <div data-message-author-role="assistant">{lastAssistantMessage}</div>
      </div>
      <Script
        src="/widget/livingface-widget.js"
        data-hq-key={DEMO_LICENSE_KEY}
        data-hq-api={DEMO_API_ORIGIN}
        strategy="afterInteractive"
      />
    </main>
  );
}
