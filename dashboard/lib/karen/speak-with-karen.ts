"use client";

/**
 * Back-compat re-export — canonical Web Audio pipeline lives in `lib/karen/voice.ts`.
 */
export {
  chunkSpeechText,
  generateAudioBuffer,
  getAudioBuffer,
  getKarenAudioContext,
  getRegisteredKarenTalkingHead,
  registerKarenTalkingHead,
  speakWithKaren,
  stopKarenSpeech,
  synthesizeLipSyncProxyBuffer,
  unlockKarenAudio,
  type GenerateAudioBufferOptions,
  type SpeakWithKarenOptions,
} from "@/lib/karen/voice";
