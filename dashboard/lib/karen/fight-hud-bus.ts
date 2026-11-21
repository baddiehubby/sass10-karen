/**
 * Page-level fight HUD bus — meters, hit flash, and damage popups
 * live outside the shaking chat stage so they stay readable.
 */

export type FightHudSnapshot = {
  visible: boolean;
  dignity: number;
  patience: number;
};

export type FightHitPose = "scream" | "laugh";

export type FightHitEvent = {
  id: number;
  amount: number;
  target: "dignity" | "patience";
  pose: FightHitPose;
};

type HudListener = (snap: FightHudSnapshot) => void;
type HitListener = (hit: FightHitEvent) => void;

const hudListeners = new Set<HudListener>();
const hitListeners = new Set<HitListener>();

let hud: FightHudSnapshot = {
  visible: false,
  dignity: 100,
  patience: 100,
};
let nextHitId = 1;

export function getFightHud(): FightHudSnapshot {
  return hud;
}

export function subscribeFightHud(listener: HudListener): () => void {
  hudListeners.add(listener);
  listener(hud);
  return () => {
    hudListeners.delete(listener);
  };
}

export function dispatchFightHud(next: FightHudSnapshot): void {
  hud = {
    visible: Boolean(next.visible),
    dignity: next.dignity,
    patience: next.patience,
  };
  hudListeners.forEach((l) => {
    try {
      l(hud);
    } catch (err) {
      console.warn("[fight-hud] listener error", err);
    }
  });
}

export function subscribeFightHit(listener: HitListener): () => void {
  hitListeners.add(listener);
  return () => {
    hitListeners.delete(listener);
  };
}

export function dispatchFightHit(
  evt: Omit<FightHitEvent, "id">,
): FightHitEvent | null {
  const amount = Math.max(0, Math.round(evt.amount));
  if (amount <= 0) return null;
  const hit: FightHitEvent = {
    id: nextHitId++,
    amount,
    target: evt.target,
    pose: evt.pose ?? (evt.target === "dignity" ? "scream" : "laugh"),
  };
  hitListeners.forEach((l) => {
    try {
      l(hit);
    } catch (err) {
      console.warn("[fight-hud] hit listener error", err);
    }
  });
  return hit;
}
