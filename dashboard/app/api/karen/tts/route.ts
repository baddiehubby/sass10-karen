import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/lib/api-json";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
    /** Optional mood hint for rate/pitch styling. */
    mood: z.string().trim().max(32).optional(),
  })
  .strict();

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function toArrayBuffer(buf: ArrayBuffer | Buffer | Uint8Array): ArrayBuffer {
  if (buf instanceof ArrayBuffer) return buf;
  const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

function audioResponse(
  buf: ArrayBuffer | Buffer | Uint8Array,
  contentType: string,
  extraHeaders?: Record<string, string>,
) {
  return new NextResponse(toArrayBuffer(buf), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function speedForMood(mood?: string): number {
  const key = (mood || "").toUpperCase();
  if (key === "ANGRY" || key === "FURIOUS") return 1.15;
  if (key === "SARCASTIC") return 1.1;
  if (key === "PROUD" || key === "SWEET") return 1.0;
  return 1.08;
}

/** OpenAI Audio Speech API → MP3. */
async function synthesizeOpenAI(text: string, mood?: string): Promise<Response | null> {
  const key = process.env.OPENAI_API_KEY || process.env.KAREN_TTS_API_KEY;
  if (!key) return null;

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.KAREN_TTS_MODEL || "tts-1",
      // Force female OpenAI voices only (nova/shimmer/alloy — never echo/onyx/fable).
      voice: (() => {
        const raw = (process.env.KAREN_TTS_VOICE || "nova").toLowerCase();
        const female = new Set(["nova", "shimmer", "alloy", "coral", "sage"]);
        if (!female.has(raw)) {
          console.warn("[karen/tts] non-female OpenAI voice — forcing nova", raw);
          return "nova";
        }
        return raw;
      })(),
      input: text,
      speed: speedForMood(mood),
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[karen/tts] OpenAI failed", res.status, errText.slice(0, 200));
    return null;
  }
  return audioResponse(await res.arrayBuffer(), "audio/mpeg");
}

/** Google Cloud Text-to-Speech REST → MP3. */
async function synthesizeGoogle(text: string, mood?: string): Promise<Response | null> {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) return null;

  const angry = (mood || "").toUpperCase() === "ANGRY" || (mood || "").toUpperCase() === "FURIOUS";
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: process.env.KAREN_TTS_LANG || "en-US",
          name: process.env.KAREN_TTS_GOOGLE_VOICE || "en-US-Neural2-F",
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: speedForMood(mood),
          pitch: angry ? 2.0 : 1.2,
        },
      }),
    },
  );

  if (!res.ok) {
    console.error("[karen/tts] Google TTS failed", res.status);
    return null;
  }

  const data = (await res.json()) as { audioContent?: string };
  if (!data.audioContent) return null;
  return audioResponse(Uint8Array.from(Buffer.from(data.audioContent, "base64")), "audio/mpeg");
}

/**
 * Dev/local fallback: Google Translate TTS (short chunks).
 * Prefer OpenAI / Google Cloud keys in production.
 */
async function synthesizeTranslateFallback(text: string): Promise<Response | null> {
  if (process.env.KAREN_TTS_ALLOW_TRANSLATE_FALLBACK === "0") return null;

  const chunks: string[] = [];
  const max = 180;
  let rest = text;
  while (rest.length) {
    if (rest.length <= max) {
      chunks.push(rest);
      break;
    }
    let cut = rest.lastIndexOf(" ", max);
    if (cut < 40) cut = max;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }

  const parts: Buffer[] = [];
  for (const chunk of chunks) {
    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-US&q=" +
      encodeURIComponent(chunk);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    });
    if (!res.ok) {
      console.warn("[karen/tts] translate fallback chunk failed", res.status);
      return null;
    }
    parts.push(Buffer.from(await res.arrayBuffer()));
  }

  if (!parts.length) return null;
  return audioResponse(new Uint8Array(Buffer.concat(parts)), "audio/mpeg");
}

/** Minimal mono PCM WAV with a speech-like amplitude envelope (lip-sync proxy). */
function buildLipSyncProxyWav(text: string): Buffer {
  const sampleRate = 22050;
  const wordCount = Math.max(1, text.trim().split(/\s+/).length);
  const durationSec = Math.min(18, Math.max(0.7, wordCount * 0.32));
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const syllable = 0.5 + 0.5 * Math.sin(t * Math.PI * 4.2);
    // Near-silent — client layers speechSynthesis; TalkingHead needs a real buffer.
    const sample = Math.max(-1, Math.min(1, 0.012 * syllable * Math.sin(2 * Math.PI * 180 * t)));
    buf.writeInt16LE((sample * 0x7fff) | 0, 44 + i * 2);
  }

  return buf;
}

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { text, mood } = parsed.data;

  try {
    const openai = await synthesizeOpenAI(text, mood);
    if (openai) return openai;

    const google = await synthesizeGoogle(text, mood);
    if (google) return google;

    const fallback = await synthesizeTranslateFallback(text);
    if (fallback) return fallback;

    // Last resort: speech-shaped WAV so clients can always decode → speakAudio.
    // Client may still layer speechSynthesis on top when peak is near-silent.
    console.warn("[karen/tts] no provider — returning lip-sync proxy WAV");
    return audioResponse(buildLipSyncProxyWav(text), "audio/wav", {
      "X-Karen-TTS": "proxy",
    });
  } catch (err) {
    console.error("[karen/tts]", err);
    return noStoreJson({ error: "TTS synthesis failed" }, 500);
  }
}
