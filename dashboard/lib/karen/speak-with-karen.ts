"use client";

/**
 * Back-compat re-export — canonical Web Audio pipeline lives in `lib/karen/voice.ts`.
 */
export {
  chunkSpeechText,
  generateAudioBuffer,
  getKarenAudioContext,
  getRegisteredKarenTalkingHead,
  registerKarenTalkingHead,
  speakWithKaren,
  stopKarenSpeech,
  type GenerateAudioBufferOptions,
  type SpeakWithKarenOptions,
} from "@/lib/karen/voice";
