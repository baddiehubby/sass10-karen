"use client";

/**
 * When a GLB/VRM has no ARKit blendshapes, fake the physical impact of shouting:
 * rapid head bob (armature.rotation.x) + chest bone scale pulse.
 */

import * as THREE from "three";
import { subscribeKarenSpeaking } from "@/lib/karen/talkinghead-bus";

export type ShoutFallbackHost = {
  hasBlendshapes?: boolean;
  __karenHasBlendshapes?: boolean;
  isSpeaking?: boolean;
  armature?: THREE.Object3D | null;
  __karenModel?: THREE.Object3D | null;
  __karenShoutDetach?: () => void;
  /** Live 0–1 speech amplitude from the avatar's AnalyserNode (when available). */
  __karenReadAmplitude?: () => number;
  __karenHitUntil?: number;
};

const CHEST_NAMES = [
  "Spine2",
  "spine_02",
  "Chest",
  "chest",
  "UpperChest",
  "upper_chest",
  "Spine1",
  "spine_01",
  "Spine",
  "spine",
];

function findChestBone(root: THREE.Object3D | null | undefined): THREE.Object3D | null {
  if (!root) return null;
  for (const name of CHEST_NAMES) {
    const hit = root.getObjectByName(name);
    if (hit) return hit;
  }
  // Soft fallback: first Bone under the rig that looks like a torso.
  let bone: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (bone) return;
    if ((obj as THREE.Bone).isBone && /spine|chest|torso/i.test(obj.name)) {
      bone = obj;
    }
  });
  return bone;
}

/**
 * Massive console warning + RAF shout animation while speaking.
 * No-op when blendshapes exist. Returns an unsubscribe/cleanup fn.
 */
export function attachKarenShoutFallback(
  head: ShoutFallbackHost | null | undefined,
): () => void {
  if (!head) return () => undefined;

  const hasBlend =
    head.hasBlendshapes === true || head.__karenHasBlendshapes === true;
  head.hasBlendshapes = hasBlend;
  head.__karenHasBlendshapes = hasBlend;

  if (hasBlend) {
    console.info(
      "[karen/avatar] Blendshapes present — real jawOpen / viseme_* lip-sync enabled.",
    );
    return () => undefined;
  }

  console.warn(
    "%cWARNING: NO BLENDSHAPES DETECTED. LIP-SYNC WILL BE FAKE.",
    "color:#ff2d55;font-size:16px;font-weight:900;background:#1a0005;padding:6px 10px;",
  );
  console.warn(
    "[karen/avatar] Falling back to head-bob + chest pulse while isSpeaking. Swap in ReadyPlayerMe /models/karen.glb with ARKit morphs for real lips.",
  );

  const root = head.armature ?? head.__karenModel ?? null;
  if (!root) return () => undefined;

  const chest = findChestBone(root);
  const chestBase = chest ? chest.scale.clone() : null;
  const rootBaseScale = root.scale.clone();
  const restX = root.rotation.x;

  // Avaturn v4 (no morphs) — drive the Head bone from live amplitude so speech
  // still reads as mouth-region motion even without jawOpen.
  const headBone: THREE.Object3D | null =
    root.getObjectByName("Head") ||
    root.getObjectByName("head") ||
    null;
  const headRestX = headBone ? headBone.rotation.x : 0;

  let speaking = Boolean(head.isSpeaking);
  let raf = 0;
  let t0 = performance.now();

  const tick = (now: number) => {
    raf = 0;
    if (!speaking) return;
    if (performance.now() < (head.__karenHitUntil ?? 0)) {
      raf = requestAnimationFrame(tick);
      return;
    }
    // Motion follows REAL analyser amplitude (loud syllable = bigger bob).
    const elapsed = (now - t0) / 1000;
    const amp = head.__karenReadAmplitude?.();
    const wave =
      typeof amp === "number"
        ? Math.min(1, amp * 1.55)
        : (Math.sin(elapsed * Math.PI * 12) + 1) / 2;
    root.rotation.x = restX - 0.04 * wave;

    if (headBone) {
      // Jaw-region nod — amplitude opens the "talk" pose; silence settles.
      headBone.rotation.x = headRestX - 0.14 * wave;
    }

    if (chest && chestBase) {
      const breath = 1 + 0.02 * Math.sin(elapsed * Math.PI * 5);
      chest.scale.set(
        chestBase.x * breath,
        chestBase.y * (1 + 0.025 * wave),
        chestBase.z * breath,
      );
    } else {
      const pulse = 1 + 0.012 * wave;
      root.scale.set(
        rootBaseScale.x * pulse,
        rootBaseScale.y * pulse,
        rootBaseScale.z * pulse,
      );
    }

    raf = requestAnimationFrame(tick);
  };

  const start = () => {
    if (speaking && raf) return;
    speaking = true;
    head.isSpeaking = true;
    t0 = performance.now();
    if (!raf) raf = requestAnimationFrame(tick);
  };

  const stop = () => {
    speaking = false;
    head.isSpeaking = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    root.rotation.x = restX;
    if (headBone) headBone.rotation.x = headRestX;
    if (chest && chestBase) chest.scale.copy(chestBase);
    else root.scale.copy(rootBaseScale);
  };

  const unsub = subscribeKarenSpeaking((nowSpeaking) => {
    if (nowSpeaking) start();
    else stop();
  });

  const detach = () => {
    unsub();
    stop();
  };
  head.__karenShoutDetach = detach;
  return detach;
}
