import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/lib/api-json";
import { sessionUserId } from "@/lib/session-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ElevenLabs premium TTS for Karen.
 * Stern mature female default: Matilda (`XrExE9yKIg1WjnnlVkGX`).
 * Override with ELEVENLABS_VOICE_ID.
 */
const DEFAULT_VOICE_ID = "XrExE9yKIg1WjnnlVkGX";

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

/** Slight mood tint on top of the requested emotional-range settings. */
function voiceSettingsForMood(mood?: string) {
  const key = (mood || "").toUpperCase();
  // Base: stability 0.3 + similarity_boost 0.8 → wider emotional range.
  let stability = 0.3;
  let similarity_boost = 0.8;
  let style = 0.45;

  if (key === "ANGRY" || key === "FURIOUS") {
    stability = 0.22;
    style = 0.65;
  } else if (key === "SARCASTIC") {
    stability = 0.28;
    style = 0.55;
  } else if (key === "PROUD" || key === "SWEET") {
    stability = 0.35;
    style = 0.35;
  }

  return { stability, similarity_boost, style, use_speaker_boost: true };
}

export async function POST(req: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return noStoreJson({ error: "Unauthorized" }, 401);
  }

  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return noStoreJson({ error: "ELEVENLABS_API_KEY is not configured" }, 503);
  }

  const { text, mood } = parsed.data;
  const voiceId =
    process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";

  try {
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
      return noStoreJson(
        { error: "ElevenLabs TTS failed", status: upstream.status },
        upstream.status === 401 || upstream.status === 403 ? 502 : 502,
      );
    }

    const audio = await upstream.arrayBuffer();
    if (!audio.byteLength) {
      return noStoreJson({ error: "ElevenLabs returned empty audio" }, 502);
    }

    return new NextResponse(toArrayBuffer(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Karen-TTS": "elevenlabs",
      },
    });
  } catch (err) {
    console.error("[api/tts]", err);
    return noStoreJson({ error: "TTS synthesis failed" }, 500);
  }
}
