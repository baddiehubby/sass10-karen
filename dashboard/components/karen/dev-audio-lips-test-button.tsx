"use client";

/**
 * TEMPORARY QA — "Test Audio & Lips" (dev builds only).
 *
 * Strict path inside the click gesture:
 *   unlock AudioContext → fetch sb_01.wav → decodeAudioData → talkingHead.speakAudio()
 */
import { useCallback, useRef, useState } from "react";

import {
  fetchAudioArrayBuffer,
  normalizeKarenAudioUrl,
} from "@/lib/karen/audio-cache";
import { karenDevLog, karenDevWarn, KAREN_DEV } from "@/lib/karen/dev-log";
import { buildWordTimings } from "@/lib/karen/tts-word-timings";
import {
  copyAudioBufferToContext,
  getKarenAudioContext,
  getRegisteredKarenTalkingHead,
  playDecodedWavToTalkingHead,
  TEST_LIPS_LINE,
  TEST_LIPS_WAV,
  unlockKarenAudio,
} from "@/lib/karen/voice";

type AmpHead = {
  __karenReadAmplitude?: () => number;
  audioCtx?: AudioContext;
  audioAnalyzerNode?: AnalyserNode;
  speakAudio?: (
    r: {
      audio: AudioBuffer;
      words: string[];
      wtimes: number[];
      wdurations: number[];
    },
    opt?: { lipsyncLang?: string },
  ) => void;
  setFixedValue?: (mt: string, val: number | null) => void;
  isSpeaking?: boolean;
  armature?: unknown;
};

async function waitForHead(ms = 4000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const head = getRegisteredKarenTalkingHead();
    if (head && typeof (head as AmpHead).speakAudio === "function") return head;
    await new Promise((r) => window.setTimeout(r, 80));
  }
  return getRegisteredKarenTalkingHead();
}

function readHeadAmplitude(head: AmpHead): number {
  const custom = head.__karenReadAmplitude?.();
  if (typeof custom === "number" && custom > 0) return custom;
  const analyser = head.audioAnalyzerNode;
  if (!analyser) return 0;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, data[i]!);
  return peak / 255;
}

/** Direct QA path: decode sb_01.wav → talkingHead.speakAudio({ audio, words… }). */
async function decodeSb01AndSpeak(
  head: AmpHead,
  onStatus: (s: string) => void,
): Promise<void> {
  const ctx = await unlockKarenAudio(head as never);
  if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
    await ctx.resume().catch(() => undefined);
  }

  const url = normalizeKarenAudioUrl(TEST_LIPS_WAV);
  onStatus("fetching sb_01.wav…");
  const arrayBuffer = await fetchAudioArrayBuffer(url);
  if (!arrayBuffer.byteLength) {
    throw new Error(`empty WAV ${url}`);
  }

  onStatus("decoding AudioBuffer…");
  const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
  const audioBuffer = copyAudioBufferToContext(ctx, decoded);

  try {
    head.setFixedValue?.("jawOpen", null);
    head.setFixedValue?.("mouthClose", null);
  } catch {
    /* ignore */
  }

  const timings = buildWordTimings(TEST_LIPS_LINE, audioBuffer.duration * 1000);
  if (typeof head.speakAudio !== "function") {
    throw new Error("talkingHead.speakAudio missing");
  }

  karenDevLog("Test: feeding speakAudio", {
    url,
    sec: Number(audioBuffer.duration.toFixed(2)),
    words: timings.words.length,
    hasArmature: Boolean(head.armature),
  });

  head.speakAudio(
    {
      audio: audioBuffer,
      words: timings.words,
      wtimes: timings.wtimes,
      wdurations: timings.wdurations,
    },
    { lipsyncLang: "en" },
  );
  head.isSpeaking = true;

  await new Promise<void>((r) =>
    window.setTimeout(r, Math.max(400, audioBuffer.duration * 1000 + 80)),
  );
}

export function DevAudioLipsTestButton() {
  const [status, setStatus] = useState<string>("idle");
  const [busy, setBusy] = useState(false);
  const peakRef = useRef(0);

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    peakRef.current = 0;
    let poll = 0;
    try {
      const ctx = await unlockKarenAudio();
      if (ctx.state === "suspended") await ctx.resume();
      karenDevLog("Test button: gesture unlock done", { ctxState: ctx.state });

      const head = await waitForHead();
      if (!head || typeof (head as AmpHead).speakAudio !== "function") {
        karenDevWarn(
          "No avatar registered yet — wait for the 3D Karen to finish loading.",
        );
        setStatus("avatar not ready");
        return;
      }

      const ampHead = head as unknown as AmpHead;
      const speakCtx = ampHead.audioCtx ?? getKarenAudioContext();
      if (speakCtx.state !== "running") {
        await speakCtx.resume().catch(() => undefined);
      }

      poll = window.setInterval(() => {
        const a = readHeadAmplitude(ampHead);
        if (a > peakRef.current) peakRef.current = a;
        setStatus(`playing… amp ${a.toFixed(2)}`);
      }, 80);

      setStatus("decode → speakAudio(sb_01)…");
      try {
        await decodeSb01AndSpeak(ampHead, setStatus);
      } catch (directErr) {
        karenDevWarn("Direct speakAudio path failed — shared helper", directErr);
        await playDecodedWavToTalkingHead(TEST_LIPS_WAV, head, {
          text: TEST_LIPS_LINE,
          volume: 1,
        });
      }

      const peak = peakRef.current;
      karenDevLog("Test finished", { peakAmplitude: Number(peak.toFixed(3)) });
      if (peak < 0.01) {
        karenDevWarn(
          "Peak amplitude ≈ 0 — audio did not register on the analyser.",
        );
      }
      setStatus(
        `done · peak amp ${peak.toFixed(2)}${peak < 0.01 ? " (SILENT?)" : ""}`,
      );
    } catch (err) {
      console.error("[karen/audio-test] failed", err);
      setStatus(`error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (poll) window.clearInterval(poll);
      setBusy(false);
    }
  }, [busy]);

  if (!KAREN_DEV) return null;

  return (
    <div className="pointer-events-auto fixed bottom-3 left-3 z-[70] flex flex-col items-start gap-1">
      <button
        type="button"
        data-testid="dev-test-audio-lips"
        disabled={busy}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          void unlockKarenAudio();
          try {
            const c = getKarenAudioContext();
            if (c.state === "suspended") void c.resume();
          } catch {
            /* ignore */
          }
        }}
        onClick={() => void run()}
        className="rounded-md border border-amber-400/60 bg-black/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300 shadow-lg backdrop-blur disabled:opacity-60"
      >
        Test Audio &amp; Lips
      </button>
      <span
        data-testid="dev-test-audio-lips-status"
        className="rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-amber-200/90"
      >
        DEV · {status}
      </span>
    </div>
  );
}
