import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/lib/api-json";
import { sessionUserId } from "@/lib/session-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Karen TTS — always a stern / aggressive *female* voice.
 *
 * ElevenLabs default: Matilda (`XrExE9yKIg1WjnnlVkGX`) — mature female.
 * Aggressive alt:     Rachel  (`21m00Tcm4TlvDq8ikWAM`).
 * Override only with another *female* id via ELEVENLABS_VOICE_ID.
 *
 * Optional Voicemaker: set VOICEMAKER_API_KEY (+ VOICEMAKER_VOICE_ID=Katherine|Emma).
 */
const FEMALE_VOICE_MATILDA = "XrExE9yKIg1WjnnlVkGX";
const FEMALE_VOICE_RACHEL = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_VOICE_ID = FEMALE_VOICE_MATILDA;

/** Known male ElevenLabs presets — never allow these for Karen. */
const KNOWN_MALE_VOICE_IDS = new Set([
  "pNInz6obpgDQGcFmaJgB", // Adam
  "VR6AewLTigWG4xSOukaG", // Arnold
  "TxGEqnHWrfWFTfGW9XjX", // Josh
  "5Q0t7uMcjvnagumLfvZi", // Paul
  "yoZ06aMxZJJ28mfd3POQ", // Sam
  "ErXwobaYiN019PkySvjV", // Antoni
]);

const DEFAULT_VOICEMAKER_VOICE = "Katherine";

const bodySchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
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

/** Resolve a forced-female ElevenLabs voice id (never male / never empty default). */
function resolveKarenFemaleVoiceId(): string {
  const raw = process.env.ELEVENLABS_VOICE_ID?.trim() || "";
  if (!raw || KNOWN_MALE_VOICE_IDS.has(raw)) {
    if (raw && KNOWN_MALE_VOICE_IDS.has(raw)) {
      console.warn(
        "[api/tts] ELEVENLABS_VOICE_ID looks male — forcing Matilda (female)",
        raw,
      );
    }
    return DEFAULT_VOICE_ID;
  }
  return raw;
}

/** Mood-tinted settings — ANGRY/FURIOUS push instability for an aggressive read. */
function voiceSettingsForMood(mood?: string) {
  const key = (mood || "").toUpperCase();
  let stability = 0.3;
  let similarity_boost = 0.8;
  let style = 0.45;

  if (key === "ANGRY" || key === "FURIOUS") {
    stability = 0.18;
    style = 0.72;
    similarity_boost = 0.85;
  } else if (key === "SARCASTIC") {
    stability = 0.28;
    style = 0.55;
  } else if (key === "PROUD" || key === "SWEET") {
    stability = 0.35;
    style = 0.35;
  }

  return { stability, similarity_boost, style, use_speaker_boost: true };
}

/** Optional Voicemaker path — always Katherine/Emma (female), never Engine default. */
async function synthesizeVoicemaker(
  text: string,
  mood?: string,
): Promise<Response | null> {
  const apiKey = process.env.VOICEMAKER_API_KEY?.trim();
  if (!apiKey) return null;

  const angry =
    (mood || "").toUpperCase() === "ANGRY" ||
    (mood || "").toUpperCase() === "FURIOUS";

  // Explicit female voice — never omit voiceId (API default is often male).
  const voiceId =
    process.env.VOICEMAKER_VOICE_ID?.trim() || DEFAULT_VOICEMAKER_VOICE;
  const femaleOk = /^(katherine|emma|olivia|jessica|lisa|amy|joanna|salli)$/i.test(
    voiceId,
  );
  const forcedVoice = femaleOk ? voiceId : DEFAULT_VOICEMAKER_VOICE;
  if (!femaleOk) {
    console.warn(
      "[api/tts] VOICEMAKER_VOICE_ID not a known female — forcing Katherine",
      voiceId,
    );
  }

  const upstream = await fetch("https://developer.voicemaker.in/voice/api", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "audio/mpeg, application/json",
    },
    body: JSON.stringify({
      Engine: "neural",
      VoiceId: forcedVoice,
      LanguageCode: "en-US",
      Text: text,
      OutputFormat: "mp3",
      SampleRate: "48000",
      Effect: angry ? "angry" : "default",
      MasterSpeed: angry ? "110" : "100",
      MasterVolume: "0",
      MasterPitch: angry ? "2" : "0",
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    console.error("[api/tts] Voicemaker failed", upstream.status, errText.slice(0, 300));
    return null;
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = (await upstream.json()) as {
      path?: string;
      url?: string;
      audioUrl?: string;
    };
    const audioUrl = data.path || data.url || data.audioUrl;
    if (!audioUrl) return null;
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) return null;
    return new NextResponse(toArrayBuffer(await audioRes.arrayBuffer()), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Karen-TTS": "voicemaker",
        "X-Karen-Voice": forcedVoice,
      },
    });
  }

  const audio = await upstream.arrayBuffer();
  if (!audio.byteLength) return null;
  return new NextResponse(toArrayBuffer(audio), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-Karen-TTS": "voicemaker",
      "X-Karen-Voice": forcedVoice,
    },
  });
}

async function synthesizeElevenLabs(
  text: string,
  mood?: string,
): Promise<Response | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  const voiceId = resolveKarenFemaleVoiceId();
  const modelId =
    process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: voiceSettingsForMood(mood),
      }),
    },
  );

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    console.error("[api/tts] ElevenLabs failed", upstream.status, errText.slice(0, 300));
    return null;
  }

  const audio = await upstream.arrayBuffer();
  if (!audio.byteLength) return null;

  return new NextResponse(toArrayBuffer(audio), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-Karen-TTS": "elevenlabs",
      "X-Karen-Voice": voiceId,
      "X-Karen-Voice-Gender": "female",
    },
  });
}

export async function POST(req: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return noStoreJson({ error: "Unauthorized" }, 401);
  }

  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { text, mood } = parsed.data;

  try {
    // Prefer Voicemaker when keyed (explicit Katherine/Emma female).
    const voicemaker = await synthesizeVoicemaker(text, mood);
    if (voicemaker) return voicemaker;

    const eleven = await synthesizeElevenLabs(text, mood);
    if (eleven) return eleven;

    if (!process.env.ELEVENLABS_API_KEY && !process.env.VOICEMAKER_API_KEY) {
      return noStoreJson(
        { error: "No TTS provider configured (ELEVENLABS_API_KEY / VOICEMAKER_API_KEY)" },
        503,
      );
    }

    return noStoreJson({ error: "Female TTS synthesis failed" }, 502);
  } catch (err) {
    console.error("[api/tts]", err);
    return noStoreJson({ error: "TTS synthesis failed" }, 500);
  }
}

