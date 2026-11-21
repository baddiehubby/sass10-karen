/**
 * Module flag — when WebGL/TalkingHead init fails, combat audio uses HTMLAudioElement.
 */

let use2DFallback = false;

export function setKaren2DFallback(enabled: boolean): void {
  use2DFallback = enabled;
}

export function isKaren2DFallback(): boolean {
  return use2DFallback;
}

export const KAREN_2D_AVATAR_SRC = "/images/karen-2d.png";
