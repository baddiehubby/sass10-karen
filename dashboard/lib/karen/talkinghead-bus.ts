/**
 * Tiny pub/sub so the chat loop can drive Karen3D without a ref
 * (next/dynamic + ssr:false does not forward refs reliably).
 */

import type { KarenExpressionMood } from "@/lib/karen/expression-bridge";

export type KarenAvatarEvent = {
  mood: KarenExpressionMood | string;
  /** Full reply text — kicks speakLocalRoast (bank MP3 or TTS). */
  text?: string;
  /** When true, run speakLocalRoast → audio bank / speechSynthesis + lips. */
  lipSync?: boolean;
  isSpeaking?: boolean;
  /** Dominant roast trait — laziness/chaos force max anger morphs. */
  trait?: string | null;
  /** Exact audio-bank id, e.g. `roast:q1_gym:a:0`. */
  audioId?: string | null;
  questionId?: string | null;
  answerId?: string | null;
  /** Custom name / goal inserts → TTS-only path. */
  dynamic?: Record<string, string> | null;
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

type RageShakeListener = () => void;
const rageShakeListeners = new Set<RageShakeListener>();

/** Local roast TTS → Framer Motion full-screen rage shake. */
export function subscribeKarenRageShake(listener: RageShakeListener): () => void {
  rageShakeListeners.add(listener);
  return () => {
    rageShakeListeners.delete(listener);
  };
}

export function dispatchKarenRageShake(): void {
  rageShakeListeners.forEach((l) => {
    try {
      l();
    } catch (err) {
      console.warn("[talkinghead-bus] rage shake listener error", err);
    }
  });
}

/**
 * Cinematic camera: wide → interrogation zoom, whip pan on roast.
 * `stage-intro` / `stage-game` pick the avatar's SCREEN LAYOUT: intro = big centered face,
 * game = head raised above the answer dock so the mouth stays visible (rigged figures only).
 */
export type KarenCameraMode =
  | "wide"
  | "interrogation"
  | "whip"
  | "stage-intro"
  | "stage-game";

type CameraListener = (mode: KarenCameraMode) => void;
const cameraListeners = new Set<CameraListener>();

export function subscribeKarenCamera(listener: CameraListener): () => void {
  cameraListeners.add(listener);
  return () => {
    cameraListeners.delete(listener);
  };
}

let currentStageLayout: "intro" | "game" = "intro";

/** Last announced stage layout — lets an avatar that finishes loading late catch up. */
export function getKarenStageLayout(): "intro" | "game" {
  return currentStageLayout;
}

export function dispatchKarenCamera(mode: KarenCameraMode): void {
  if (mode === "stage-intro") currentStageLayout = "intro";
  else if (mode === "stage-game") currentStageLayout = "game";
  cameraListeners.forEach((l) => {
    try {
      l(mode);
    } catch (err) {
      console.warn("[talkinghead-bus] camera listener error", err);
    }
  });
}

/** Cold shoulder — turn avatar 180° and optionally mute speech. */
type FacingListener = (away: boolean) => void;
const facingListeners = new Set<FacingListener>();

export function subscribeKarenFacing(listener: FacingListener): () => void {
  facingListeners.add(listener);
  return () => {
    facingListeners.delete(listener);
  };
}

export function dispatchKarenFacing(away: boolean): void {
  facingListeners.forEach((l) => {
    try {
      l(away);
    } catch (err) {
      console.warn("[talkinghead-bus] facing listener error", err);
    }
  });
}

/** Mute Protocol hang-up — slide avatar off-stage + "LEFT THE CHAT" overlay. */
type HangUpListener = (hungUp: boolean) => void;
const hangUpListeners = new Set<HangUpListener>();

export function subscribeKarenHangUp(listener: HangUpListener): () => void {
  hangUpListeners.add(listener);
  return () => {
    hangUpListeners.delete(listener);
  };
}

export function dispatchKarenHangUp(hungUp: boolean): void {
  hangUpListeners.forEach((l) => {
    try {
      l(hungUp);
    } catch (err) {
      console.warn("[talkinghead-bus] hang-up listener error", err);
    }
  });
}

/** Landed scream — Karen physically recoils on the 3D canvas. */
type RecoilListener = () => void;
const recoilListeners = new Set<RecoilListener>();

export function subscribeKarenRecoil(listener: RecoilListener): () => void {
  recoilListeners.add(listener);
  return () => {
    recoilListeners.delete(listener);
  };
}

export function dispatchKarenRecoil(): void {
  recoilListeners.forEach((l) => {
    try {
      l();
    } catch (err) {
      console.warn("[talkinghead-bus] recoil listener error", err);
    }
  });
}

/** FURIOUS red-alert wash over the stage. */
type FuriousAlertListener = (furious: boolean) => void;
const furiousAlertListeners = new Set<FuriousAlertListener>();

export function subscribeKarenFuriousAlert(
  listener: FuriousAlertListener,
): () => void {
  furiousAlertListeners.add(listener);
  return () => {
    furiousAlertListeners.delete(listener);
  };
}

export function dispatchKarenFuriousAlert(furious: boolean): void {
  furiousAlertListeners.forEach((l) => {
    try {
      l(furious);
    } catch (err) {
      console.warn("[talkinghead-bus] furious alert listener error", err);
    }
  });
}

/** Faith Shatter paywall — soft-blur the 3D avatar behind the ultimatum. */
type StageBlurListener = (blurred: boolean) => void;
const stageBlurListeners = new Set<StageBlurListener>();

export function subscribeKarenStageBlur(
  listener: StageBlurListener,
): () => void {
  stageBlurListeners.add(listener);
  return () => {
    stageBlurListeners.delete(listener);
  };
}

export function dispatchKarenStageBlur(blurred: boolean): void {
  stageBlurListeners.forEach((l) => {
    try {
      l(blurred);
    } catch (err) {
      console.warn("[talkinghead-bus] stage blur listener error", err);
    }
  });
}
