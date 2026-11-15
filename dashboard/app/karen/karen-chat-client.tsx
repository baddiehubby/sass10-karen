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
import { apiUrl } from "@/lib/api-url";
import {
  normalizeMood,
  parseMoodTag,
  stripMoodTags,
} from "@/lib/karen/expression-bridge";
import { dispatchKarenExpression } from "@/lib/karen/talkinghead-bus";
import { unlockKarenAudio } from "@/lib/karen/voice";
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
  isSignedIn?: boolean;
};

/** Full-bleed cinematic gate — Karen behind a dark veil, neon CTA in front. */
function KarenLoginGate() {
  return (
    <div className="relative flex h-[100dvh] min-h-[100vh] w-screen flex-col items-center justify-center overflow-hidden bg-black px-6 text-center">
      <div className="absolute inset-0 z-0 h-full min-h-[100vh] w-full">
        <Karen3D mood="SARCASTIC" isSpeaking={false} className="absolute inset-0" />
      </div>
      {/* Dark cinematic overlay over Karen's face */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-black/75"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_50%_35%,rgba(244,63,94,0.18)_0%,transparent_55%),linear-gradient(180deg,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.55)_45%,rgba(0,0,0,0.88)_100%)]"
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex max-w-lg flex-col items-center gap-7"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-rose-400/90">
          Karen · Sass 10
        </p>
        <p className="max-w-md text-xl font-medium leading-relaxed text-white/95 sm:text-2xl">
          WARNING: Karen has zero tolerance for excuses. She will roast you. Proceed?
        </p>
        <Link
          href="/login?callbackUrl=/karen"
          onClick={() => {
            void unlockKarenAudio();
          }}
          className="mt-1 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#ff2d55] via-[#ff4d6d] to-[#ff2d85] px-12 py-4 text-sm font-black uppercase tracking-[0.22em] text-white shadow-[0_0_28px_rgba(255,45,85,0.75),0_0_64px_rgba(255,45,133,0.45)] transition hover:scale-[1.04] hover:shadow-[0_0_40px_rgba(255,45,85,0.95),0_0_80px_rgba(255,45,133,0.55)] active:scale-[0.98]"
        >
          Enter the Roast
        </Link>
      </motion.div>
    </div>
  );
}

export function KarenChatClient({
  initialIsPremium = false,
  initialChatCount = 0,
  isSignedIn = false,
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
  const [needsAuth, setNeedsAuth] = useState(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      if (q.get("preview") === "1") return false;
    }
    return !isSignedIn;
  });
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
  const isSarcastic = mood === "SARCASTIC";

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

      // Unlock Web Audio inside the user gesture (Send / Hold-to-talk).
      await unlockKarenAudio();

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
        const res = await fetch(apiUrl("/api/karen/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ message: text, history }),
          credentials: "include",
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
            setNeedsAuth(true);
            setError(null);
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

    void unlockKarenAudio();
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

  // [ANGRY] / [FURIOUS]: violent full-screen rage shake
  useEffect(() => {
    const prev = prevMoodRef.current;
    prevMoodRef.current = mood;
    if (mood !== "ANGRY" && mood !== "FURIOUS") return;
    if (prev === mood) return;
    void screenShake.start({
      x: [0, -14, 14, -12, 12, -8, 8, 0],
      y: [0, 8, -8, 7, -6, 4, -3, 0],
      rotate: [0, -1.2, 1.4, -1.1, 0.9, -0.6, 0.4, 0],
      transition: { duration: 0.45, ease: "easeInOut" },
    });
  }, [mood, screenShake]);

  if (needsAuth) {
    return <KarenLoginGate />;
  }

  return (
    /* [SARCASTIC] smirk: entire UI (canvas + chat) tilts 2° */
    <motion.div
      animate={{ rotateZ: isSarcastic ? 2 : 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 18, mass: 0.85 }}
      className="relative h-[100dvh] min-h-[100vh] w-screen origin-center overflow-hidden bg-[#0a0608] text-white"
      style={
        isFurious
          ? { boxShadow: "inset 0 0 50px rgba(255,0,0,0.5)" }
          : undefined
      }
    >
      <motion.div
        animate={screenShake}
        className="relative h-full min-h-[100vh] w-full"
      >
      <VipUpgradeModal
        open={vipOpen}
        message={vipMessage}
        onClose={() => {
          setVipOpen(false);
          setActiveTab("chat");
        }}
      />

      {/* Avatar layer — full screen, z-0 */}
      <div className="absolute inset-0 z-0 h-full min-h-[100vh] w-full">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_55%_35%,#3a1524_0%,#12080c_50%,#050305_100%)]"
          aria-hidden
        />
        <div
          className={`absolute inset-0 h-full w-full transition-[filter,transform] duration-500 ${
            paywalled || avatarFrozen
              ? "pointer-events-none scale-[1.03] blur-3xl brightness-50 saturate-40"
              : ""
          }`}
        >
          <Karen3D
            mood={paywalled || avatarFrozen ? "ANGRY" : mood}
            isSpeaking={paywalled || avatarFrozen ? false : isSpeaking}
            className="absolute inset-0 h-full w-full"
          />
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[50%] bg-gradient-to-t from-black/70 via-black/25 to-transparent"
          aria-hidden
        />
        <AnimatePresence>
          {isFurious ? (
            <motion.div
              key="rage-glow"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.7, 1, 0.7] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-none absolute inset-0 z-[2] border-[3px] border-red-500"
              style={{
                boxShadow:
                  "inset 0 0 50px rgba(255,0,0,0.5), 0 0 40px rgba(255,0,0,0.35)",
              }}
              aria-hidden
            />
          ) : null}
        </AnimatePresence>
        <KarenPaywallOverlay active={paywalled} />
      </div>

      {/* Floating glass header */}
      <header className="absolute left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 mx-auto flex max-w-lg items-center justify-between rounded-3xl border border-white/10 bg-black/30 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur-xl sm:max-w-xl">
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

      {/* iOS glassmorphism chat — bottom overlay z-10 */}
      <div className="absolute bottom-0 z-10 w-full pb-[calc(3.75rem+env(safe-area-inset-bottom))]">
        <section
          className={`relative mx-auto flex max-h-[42dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] border-t border-white/20 bg-black/60 p-4 shadow-2xl backdrop-blur-2xl sm:max-w-xl ${
            isFurious
              ? "shadow-[0_-24px_64px_rgba(255,0,0,0.45),0_0_40px_rgba(255,45,85,0.25)]"
              : ""
          }`}
        >
          {/* Subtle glowing red aura when [ANGRY] */}
          <AnimatePresence>
            {isFurious ? (
              <motion.div
                key="chat-rage-aura"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.55, 1, 0.55] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-16 rounded-t-[2rem]"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 0%, rgba(255,45,85,0.55) 0%, transparent 70%)",
                  boxShadow: "0 -8px 32px rgba(255,0,0,0.35)",
                }}
                aria-hidden
              />
            ) : null}
          </AnimatePresence>

          <div className="relative z-[2] min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const displayText =
                  m.role === "karen" ? stripMoodTags(m.text) || m.text : m.text;
                return (
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
                          ? "max-w-[82%] rounded-[1.15rem] rounded-br-md bg-[#ff2d55] px-3.5 py-2.5 text-[15px] leading-snug text-white shadow-[0_0_20px_rgba(255,45,85,0.35)]"
                          : "max-w-[82%] rounded-[1.15rem] rounded-bl-md border border-rose-500/40 bg-zinc-900/90 px-3.5 py-2.5 text-[15px] leading-snug text-rose-50 shadow-[0_0_24px_rgba(244,63,94,0.22)]"
                      }
                    >
                      {displayText}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <AnimatePresence>
              {typing ? (
                <motion.div
                  key="judging"
                  initial={{ opacity: 0, x: -28, y: 8 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: -12, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  className="flex justify-start"
                  aria-live="polite"
                >
                  <div className="rounded-[1.15rem] rounded-bl-md border border-rose-500/45 bg-zinc-900/95 px-3.5 py-2.5 text-sm text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
                    <span className="inline-flex items-center gap-2.5 font-medium">
                      <span className="inline-flex items-center gap-1" aria-hidden>
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400"
                            animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] }}
                            transition={{
                              duration: 0.85,
                              repeat: Infinity,
                              delay: i * 0.16,
                              ease: "easeInOut",
                            }}
                          />
                        ))}
                      </span>
                      <span className="text-rose-50/95">Karen is judging you...</span>
                    </span>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div ref={bottomRef} />
          </div>

          {error ? (
            <p className="relative z-[2] mt-2 rounded-xl border border-red-500/25 bg-red-950/50 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="relative z-[2] mt-3 flex gap-2">
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
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none ring-rose-500/40 backdrop-blur-md focus:ring-2 disabled:opacity-60"
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
              className={`inline-flex shrink-0 touch-none select-none items-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-semibold text-white ${
                listening
                  ? "bg-rose-600 shadow-[0_0_24px_rgba(244,63,94,0.7)]"
                  : "border border-white/10 bg-white/5 backdrop-blur-md"
              } disabled:opacity-40`}
            >
              <Mic className="h-4 w-4" />
              {listening ? "…" : "Hold"}
            </button>
            <button
              type="submit"
              disabled={typing || listening || paywalled || !input.trim()}
              className="shrink-0 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(244,63,94,0.35)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </section>
      </div>

      {/* Bottom nav */}
      <nav
        className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-black/50 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"
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
    </motion.div>
  );
}
