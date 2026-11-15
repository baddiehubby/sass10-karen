"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { AlarmClock, Crown, MessageCircle, Mic } from "lucide-react";
import dynamic from "next/dynamic";

/** TalkingHead / WebGL — client-only to avoid SSR window crashes. */
const Karen3D = dynamic(() => import("@/components/Karen3D"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex h-screen w-screen items-center justify-center bg-zinc-950">
      <div className="h-40 w-40 animate-pulse rounded-full bg-rose-500/20 ring-2 ring-rose-400/30" />
    </div>
  ),
});
import { VipUpgradeModal } from "@/components/karen/vip-upgrade-modal";
import { KarenPaywallOverlay } from "@/components/karen/karen-paywall-overlay";
import { useKarenVoice } from "@/hooks/useKarenVoice";
import {
  normalizeMood,
  parseMoodTag,
  stripMoodTags,
} from "@/lib/karen/expression-bridge";
import { dispatchKarenExpression } from "@/lib/karen/talkinghead-bus";
import {
  KAREN_FREE_MESSAGE_LIMIT,
  KAREN_VIP_UPGRADE_MESSAGE,
} from "@/lib/karen/vip";

type ChatRole = "user" | "karen";

type ChatBubble = {
  id: string;
  role: ChatRole;
  text: string;
  mood?: string;
};

type NavTab = "chat" | "alarms" | "upgrade";

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export type KarenChatClientProps = {
  initialIsPremium?: boolean;
  initialChatCount?: number;
};

export function KarenChatClient({
  initialIsPremium = false,
  initialChatCount = 0,
}: KarenChatClientProps = {}) {
  const { isSpeaking } = useKarenVoice();
  const [messages, setMessages] = useState<ChatBubble[]>([
    {
      id: "welcome",
      role: "karen",
      text: "I'm Karen. Skip the pep talk — what's the habit you keep abandoning?",
      mood: "SARCASTIC",
    },
  ]);
  const [mood, setMood] = useState("SARCASTIC");
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vipOpen, setVipOpen] = useState(false);
  const [vipMessage, setVipMessage] = useState(KAREN_VIP_UPGRADE_MESSAGE);
  const [isPremium, setIsPremium] = useState<boolean | null>(initialIsPremium);
  const [serverChatCount, setServerChatCount] = useState(initialChatCount);
  /** Freeze 3D stage after HTTP 402 until they upgrade or dismiss. */
  const [avatarFrozen, setAvatarFrozen] = useState(
    initialIsPremium !== true && initialChatCount >= KAREN_FREE_MESSAGE_LIMIT,
  );
  const [activeTab, setActiveTab] = useState<NavTab>("chat");
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const messagesRef = useRef(messages);
  const typingRef = useRef(typing);
  const prevMoodRef = useRef(mood);
  const screenShake = useAnimationControls();
  const isFurious = mood === "ANGRY" || mood === "FURIOUS";

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    typingRef.current = typing;
  }, [typing]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const openVip = useCallback((msg?: string) => {
    setVipMessage(msg || KAREN_VIP_UPGRADE_MESSAGE);
    setVipOpen(true);
    setActiveTab("upgrade");
  }, []);

  /** Trigger angry face + freeze avatar when Lemon paywall hits. */
  const triggerPaywall = useCallback(
    (msg?: string) => {
      setIsPremium(false);
      setServerChatCount(KAREN_FREE_MESSAGE_LIMIT);
      setAvatarFrozen(true);
      setMood("ANGRY");
      dispatchKarenExpression({
        mood: "ANGRY",
        lipSync: false,
        isSpeaking: false,
      });
      openVip(msg || KAREN_VIP_UPGRADE_MESSAGE);
    },
    [openVip],
  );

  const localUserMessages = messages.filter((m) => m.role === "user").length;
  const usedMessages = Math.max(serverChatCount, localUserMessages);
  const paywalled =
    avatarFrozen ||
    (isPremium !== true && usedMessages >= KAREN_FREE_MESSAGE_LIMIT);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || typingRef.current) return;
      if (isPremium !== true) {
        const nextCount = Math.max(serverChatCount, messagesRef.current.filter((m) => m.role === "user").length) + 1;
        if (nextCount > KAREN_FREE_MESSAGE_LIMIT) {
          triggerPaywall(KAREN_VIP_UPGRADE_MESSAGE);
          return;
        }
      }

      setError(null);
      setInput("");
      const userMsg: ChatBubble = {
        id: `u-${Date.now()}`,
        role: "user",
        text,
      };
      const karenId = `k-${Date.now()}`;
      const prior = messagesRef.current;
      setMessages((prev) => [...prev, userMsg]);
      setTyping(true);

      const history = [...prior, userMsg]
        .filter((m) => m.id !== "welcome")
        .slice(-12)
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.text,
        }));

      try {
        const res = await fetch("/api/karen/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ message: text, history }),
        });

        const contentType = res.headers.get("content-type") || "";

        // Auth / VIP / hard errors stay JSON.
        if (!contentType.includes("text/event-stream")) {
          const data = (await res.json()) as {
            reply?: string | null;
            mood?: string | null;
            error?: string;
            isPremium?: boolean;
          };
          if (typeof data.isPremium === "boolean") setIsPremium(data.isPremium);
          if (res.status === 402) {
            triggerPaywall(data.error || KAREN_VIP_UPGRADE_MESSAGE);
            setError(data.error || KAREN_VIP_UPGRADE_MESSAGE);
            return;
          }
          if (res.status === 401) {
            setError("Sign in to talk to Karen.");
            return;
          }
          throw new Error(data.error || "Karen couldn't answer. Is Ollama running?");
        }

        if (!res.ok || !res.body) {
          throw new Error("Karen stream failed. Is Ollama running?");
        }

        // Insert streaming bubble immediately so first tokens paint fast.
        setMessages((prev) => [
          ...prev,
          { id: karenId, role: "karen", text: "", mood: "SARCASTIC" },
        ]);
        setTyping(false);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalReply = "";
        let finalMood = "SARCASTIC";

        /** Drive TalkingHead face; lip-sync (speakWithKaren) only on final reply. */
        const applyFaceFromReply = (
          reply: string,
          moodRaw: string,
          opts: { lipSync?: boolean; speaking?: boolean } = {},
        ) => {
          const fromTag = parseMoodTag(reply);
          const nextMood = normalizeMood(fromTag || moodRaw);
          setMood(nextMood);
          dispatchKarenExpression({
            mood: nextMood,
            text: stripMoodTags(reply) || reply,
            lipSync: Boolean(opts.lipSync),
            isSpeaking: Boolean(opts.speaking),
          });
          return nextMood;
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const line = part
              .split("\n")
              .map((l) => l.trim())
              .find((l) => l.startsWith("data:"));
            if (!line) continue;
            const json = line.replace(/^data:\s*/, "");
            let evt: {
              type?: string;
              reply?: string;
              mood?: string | null;
              isPremium?: boolean;
              error?: string;
            };
            try {
              evt = JSON.parse(json) as typeof evt;
            } catch {
              continue;
            }

            if (evt.type === "meta" && typeof evt.isPremium === "boolean") {
              setIsPremium(evt.isPremium);
            }

            if (evt.type === "token") {
              if (evt.mood) {
                finalMood = normalizeMood(evt.mood);
              }
              if (typeof evt.reply === "string") {
                finalReply = evt.reply;
                finalMood = applyFaceFromReply(evt.reply, finalMood, { speaking: false });
                const display = stripMoodTags(evt.reply) || evt.reply;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === karenId
                      ? { ...m, text: display, mood: finalMood }
                      : m,
                  ),
                );
              }
            }

            if (evt.type === "done") {
              if (typeof evt.isPremium === "boolean") setIsPremium(evt.isPremium);
              finalReply = evt.reply || finalReply;
              finalMood = applyFaceFromReply(finalReply, evt.mood || finalMood, {
                lipSync: true,
                speaking: true,
              });
              const display = stripMoodTags(finalReply) || finalReply;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === karenId ? { ...m, text: display, mood: finalMood } : m,
                ),
              );
            }

            if (evt.type === "error") {
              throw new Error(evt.error || "Karen chat failed");
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Chat failed";
        setError(msg);
        setMessages((prev) => prev.filter((m) => m.id !== karenId || m.text.trim()));
      } finally {
        setTyping(false);
      }
    },
    [triggerPaywall, isPremium, serverChatCount],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (paywalled) {
      triggerPaywall();
      return;
    }
    void sendMessage(input);
  }

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (typingRef.current) return;
    if (paywalled) {
      triggerPaywall(KAREN_VIP_UPGRADE_MESSAGE);
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Speech recognition is not supported in this browser (try Chrome).");
      return;
    }

    setError(null);
    transcriptRef.current = "";

    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }

    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < ev.results.length; i++) {
        const piece = ev.results[i]?.[0]?.transcript ?? "";
        if (ev.results[i]?.isFinal) finalText += piece;
        else interim += piece;
      }
      transcriptRef.current = `${finalText}${interim}`.trim();
      if (transcriptRef.current) setInput(transcriptRef.current);
    };

    rec.onerror = (ev) => {
      if (ev.error === "aborted" || ev.error === "no-speech") return;
      setError(`Mic error: ${ev.error}`);
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      const spoken = transcriptRef.current.trim();
      if (spoken) void sendMessage(spoken);
    };

    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Could not start the microphone.");
      setListening(false);
    }
  }, [sendMessage, paywalled, triggerPaywall]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // [ANGRY] / [FURIOUS]: violent full-screen shake for ~0.2s
  useEffect(() => {
    const prev = prevMoodRef.current;
    prevMoodRef.current = mood;
    if (mood !== "ANGRY" && mood !== "FURIOUS") return;
    if (prev === mood) return;
    void screenShake.start({
      x: [0, -14, 16, -12, 10, -6, 3, 0],
      y: [0, 10, -8, 9, -6, 4, -2, 0],
      rotate: [0, -1.2, 1.4, -1, 0.6, 0],
      transition: { duration: 0.2, ease: "easeOut" },
    });
  }, [mood, screenShake]);

  return (
    <motion.div
      animate={screenShake}
      className="relative h-[100dvh] w-screen overflow-hidden bg-black text-white"
    >
      <VipUpgradeModal
        open={vipOpen}
        message={vipMessage}
        onClose={() => {
          setVipOpen(false);
          setActiveTab("chat");
        }}
      />

      {/* Full-viewport TalkingHead stage */}
      <div className="absolute inset-0 z-0 h-screen w-screen">
        <div
          className={`absolute inset-0 h-full w-full transition-[filter,transform] duration-300 ${
            paywalled || avatarFrozen
              ? "pointer-events-none blur-md brightness-75 saturate-50 scale-[1.02]"
              : ""
          }`}
        >
          <Karen3D
            mood={paywalled || avatarFrozen ? "ANGRY" : mood}
            isSpeaking={paywalled || avatarFrozen ? false : isSpeaking}
            className="h-full w-full"
          />
        </div>
        {/* Readability veil over red shirt / lower body */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[55%] bg-gradient-to-t from-black/80 via-black/40 to-transparent"
          aria-hidden
        />
        {/* Furious screen glow border */}
        {isFurious ? (
          <div
            className="pointer-events-none absolute inset-0 z-[2] border-[3px] border-red-500 shadow-[inset_0_0_60px_rgba(239,68,68,0.55),0_0_40px_rgba(239,68,68,0.45)] animate-pulse"
            aria-hidden
          />
        ) : null}
        <KarenPaywallOverlay active={paywalled} />
      </div>

      {/* Floating glass header */}
      <header className="absolute left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 mx-auto flex max-w-lg items-center justify-between rounded-3xl border border-white/20 bg-white/10 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur-md sm:max-w-xl">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-rose-300">
            Karen · SASS10
          </p>
          <h1 className="text-lg font-semibold tracking-tight text-white drop-shadow-md">
            No excuses
          </h1>
        </div>
        {isPremium === true ? (
          <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200">
            VIP
          </span>
        ) : (
          <button
            type="button"
            onClick={() => openVip()}
            className="rounded-full bg-gradient-to-r from-rose-600 to-pink-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-[0_0_20px_rgba(244,63,94,0.45)]"
          >
            $19 VIP
          </button>
        )}
      </header>

      {/* Glassmorphic chat floating over avatar */}
      <div className="absolute inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-3">
        <section className="mx-auto flex max-h-[38dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:max-w-xl">
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3 sm:px-4">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, x: m.role === "user" ? 48 : -48, y: 12 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.7 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-md bg-zinc-800 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-100 shadow-lg shadow-black/30"
                        : "max-w-[85%] rounded-2xl rounded-bl-md border border-red-500/50 bg-red-500/20 px-3.5 py-2.5 text-sm leading-relaxed text-rose-50 shadow-[0_0_24px_rgba(244,63,94,0.28)]"
                    }
                  >
                    {m.role === "karen" && m.mood ? (
                      <span className="mb-1 block text-[10px] font-semibold tracking-wider text-rose-300/90">
                        [{m.mood}]
                      </span>
                    ) : null}
                    {m.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {typing ? (
              <motion.div
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex justify-start"
              >
                <div className="rounded-2xl border border-red-500/40 bg-red-500/20 px-3.5 py-2.5 text-sm text-rose-100 backdrop-blur-md">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                    </span>
                    Sarcasm 10
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.1, repeat: Infinity }}
                    >
                      …
                    </motion.span>
                  </span>
                </div>
              </motion.div>
            ) : null}

            <div ref={bottomRef} />
          </div>

          {error ? (
            <p className="border-t border-red-500/25 bg-red-950/50 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          <form
            onSubmit={onSubmit}
            className="flex gap-2 border-t border-white/15 bg-black/25 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                paywalled
                  ? "Unlock Savage Karen to keep talking…"
                  : listening
                    ? "Listening…"
                    : "Confess the excuse…"
              }
              disabled={typing || listening || paywalled}
              className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-zinc-400 outline-none ring-rose-500/40 backdrop-blur-md focus:ring-2 disabled:opacity-60"
              autoComplete="off"
              maxLength={2000}
            />
            <button
              type="button"
              disabled={typing || paywalled}
              aria-label="Hold to talk"
              onPointerDown={(e) => {
                e.preventDefault();
                if (paywalled) {
                  triggerPaywall();
                  return;
                }
                (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                startListening();
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                stopListening();
              }}
              onPointerCancel={() => stopListening()}
              onContextMenu={(e) => e.preventDefault()}
              className={`inline-flex shrink-0 touch-none select-none items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-white ${
                listening
                  ? "bg-rose-600 shadow-[0_0_24px_rgba(244,63,94,0.7)]"
                  : "border border-white/20 bg-white/10 backdrop-blur-md"
              } disabled:opacity-40`}
            >
              <Mic className="h-4 w-4" />
              {listening ? "Listening…" : "Hold"}
            </button>
            <button
              type="submit"
              disabled={typing || listening || paywalled || !input.trim()}
              className="shrink-0 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(244,63,94,0.35)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </section>
      </div>

      {/* Bottom nav — glass over avatar */}
      <nav
        className="absolute bottom-0 left-0 right-0 z-40 border-t border-white/15 bg-black/50 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md"
        aria-label="Karen navigation"
      >
        <div className="mx-auto grid max-w-lg grid-cols-3 gap-1 sm:max-w-xl">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold uppercase tracking-wider transition ${
              activeTab === "chat"
                ? "bg-rose-500/20 text-rose-300"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <MessageCircle className="h-5 w-5" />
            Chat
          </button>

          <Link
            href="/karen/alarm"
            onClick={() => setActiveTab("alarms")}
            className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold uppercase tracking-wider transition ${
              activeTab === "alarms"
                ? "bg-rose-500/20 text-rose-300"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <AlarmClock className="h-5 w-5" />
            Alarms
          </Link>

          <button
            type="button"
            onClick={() => openVip()}
            className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-black uppercase tracking-wider transition ${
              activeTab === "upgrade"
                ? "bg-gradient-to-t from-rose-600/40 to-pink-500/20 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.35)]"
                : "text-rose-400 hover:text-rose-300"
            }`}
          >
            <Crown className="h-5 w-5" />
            Upgrade VIP
          </button>
        </div>
      </nav>
    </motion.div>
  );
}
