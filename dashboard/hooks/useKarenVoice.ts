"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeKarenSpeaking } from "@/lib/karen/talkinghead-bus";
import { speakWithKaren, stopKarenSpeech } from "@/lib/karen/voice";

export type SpeakOptions = {
  /** Ignored for API TTS (full utterance replaced); kept for call-site compat. */
  append?: boolean;
  mood?: string | null;
};

/**
 * Karen voice — prefers API TTS (`/api/karen/tts`) → TalkingHead.speakAudio via bus.
 * `isSpeaking` mirrors `dispatchKarenSpeaking` from speakWithKaren.
 */
export function useKarenVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return subscribeKarenSpeaking(setIsSpeaking);
  }, []);

  const stop = useCallback(() => {
    stopKarenSpeech();
  }, []);

  /**
   * Fallback speak when avatar is not mounted — still hits API TTS / browser.
   * Prefer dispatchKarenExpression({ lipSync: true }) so Karen3D owns the head.
   */
  const speak = useCallback((text: string, opts?: SpeakOptions) => {
    void speakWithKaren(text, { mood: opts?.mood });
  }, []);

  return { speak, stop, isSpeaking, ready: { current: true } };
}
