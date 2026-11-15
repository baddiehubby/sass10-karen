/**
 * Tiny pub/sub so the chat loop can drive Karen3D without a ref
 * (next/dynamic + ssr:false does not forward refs reliably).
 */

import type { KarenExpressionMood } from "@/lib/karen/expression-bridge";

export type KarenAvatarEvent = {
  mood: KarenExpressionMood | string;
  /** Full reply text — used to kick lip-sync via speakWithKaren. */
  text?: string;
  /** When true, run speakWithKaren → TalkingHead.speakAudio. */
  lipSync?: boolean;
  isSpeaking?: boolean;
};

type Listener = (evt: KarenAvatarEvent) => void;
type SpeakingListener = (speaking: boolean) => void;

const listeners = new Set<Listener>();
const speakingListeners = new Set<SpeakingListener>();

export function subscribeKarenAvatar(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Chat loop → avatar: apply expression (+ optional lip-sync). */
export function dispatchKarenExpression(evt: KarenAvatarEvent): void {
  listeners.forEach((l) => {
    try {
      l(evt);
    } catch (err) {
      console.warn("[talkinghead-bus] listener error", err);
    }
  });
}

export function subscribeKarenSpeaking(listener: SpeakingListener): () => void {
  speakingListeners.add(listener);
  return () => {
    speakingListeners.delete(listener);
  };
}

/** speakWithKaren → UI `isSpeaking` + angry shake. */
export function dispatchKarenSpeaking(speaking: boolean): void {
  speakingListeners.forEach((l) => {
    try {
      l(speaking);
    } catch (err) {
      console.warn("[talkinghead-bus] speaking listener error", err);
    }
  });
}
