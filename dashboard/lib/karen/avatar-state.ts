/**
 * Combat avatar state machine — prevents mic/audio clashes on iOS Safari.
 */

export enum AvatarState {
  IDLE = "IDLE",
  LISTENING = "LISTENING",
  SPEAKING = "SPEAKING",
  MUTED = "MUTED",
}

type Listener = (state: AvatarState) => void;

let current: AvatarState = AvatarState.IDLE;
const listeners = new Set<Listener>();

export function getAvatarState(): AvatarState {
  return current;
}

export function setAvatarState(next: AvatarState): void {
  if (current === next) return;
  current = next;
  for (const fn of listeners) {
    try {
      fn(current);
    } catch (err) {
      console.warn("[avatar-state] listener failed", err);
    }
  }
}

export function subscribeAvatarState(fn: Listener): () => void {
  listeners.add(fn);
  fn(current);
  return () => {
    listeners.delete(fn);
  };
}

export function isAvatarSpeaking(): boolean {
  return current === AvatarState.SPEAKING;
}

export function isAvatarMuted(): boolean {
  return current === AvatarState.MUTED;
}
