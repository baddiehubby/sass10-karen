"use client";

/**
 * Persistent Hold-to-Scream mic button.
 *
 * Lifecycle rules:
 * - `webkitSpeechRecognition` lives in a useRef (see `useScreamMic`) — re-renders
 *   must not recreate / lose the instance mid-hold.
 * - This button is ALWAYS mounted. Disabled / unsupported / muted → opacity +
 *   grayscale (+ typed fallback), never `{cond && <MicButton />}`.
 * - Soft `onend` / silence → auto-restart while still holding.
 * - Hard errors → flash red + toast "Mic error. Hold again." (button stays).
 */
export {
  HoldToScream as MicButton,
  HoldToScream as default,
  type HoldToScreamProps as MicButtonProps,
} from "@/components/karen/hold-to-scream";
