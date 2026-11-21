/**
 * Physical hit on Karen's rig — pitch the armature like a fighting-game hit stun.
 * scream = lunge forward; laugh = throw the head back.
 */

export type KarenHitPose = "scream" | "laugh";

const HIT_MS = 480;
/** Forward whip after the −0.15 back-snap (loud WAV scream). */
const SCREAM_DELTA = 0.1;
/** Head thrown back — laugh / Patience hit stun. */
const LAUGH_DELTA = -0.52;
/** Unhinged scream tilt on Z. */
const SCREAM_TILT_Z = 0.08;

type RotXZ = { rotation: { x: number; z?: number } };

export type HitImpactHost = {
  armature?: RotXZ | null;
  __karenModel?: RotXZ | null;
  vrm?: { scene?: RotXZ | null } | null;
  __karenHitUntil?: number;
};

export function hitPosePeak(restX: number, pose: KarenHitPose): number {
  return pose === "laugh" ? restX + LAUGH_DELTA : restX + SCREAM_DELTA;
}

function resolveArmature(host: HitImpactHost | null | undefined): RotXZ | null {
  if (!host) return null;
  const root = host.armature ?? host.__karenModel ?? host.vrm?.scene ?? null;
  if (!root || typeof root.rotation?.x !== "number") return null;
  return root;
}

/** True while a hit throw still owns armature.rotation.x */
export function isKarenHitLocked(host: { __karenHitUntil?: number } | null | undefined): boolean {
  if (!host) return false;
  const until = host.__karenHitUntil ?? 0;
  return typeof performance !== "undefined" && performance.now() < until;
}

/**
 * Force `talkingHead.armature.rotation.x` into a scream lunge or laugh throw-back,
 * then ease to rest. Sets `__karenHitUntil` so lookAt / shout-fallback don't fight it.
 */
export function throwKarenHead(
  host: HitImpactHost | null | undefined,
  pose: KarenHitPose = "scream",
): boolean {
  if (typeof window === "undefined") return false;
  const root = resolveArmature(host);
  if (!host || !root) return false;

  const restX = root.rotation.x;
  const restZ = typeof root.rotation.z === "number" ? root.rotation.z : 0;
  const peak = hitPosePeak(restX, pose);
  const tilt = pose === "scream" ? SCREAM_TILT_Z * (Math.random() < 0.5 ? -1 : 1) : 0;
  const t0 = performance.now();
  host.__karenHitUntil = t0 + HIT_MS;

  const tick = (now: number) => {
    const u = Math.min(1, (now - t0) / HIT_MS);
    if (pose === "scream") {
      // Match talkinghead-factory snap: −0.15 back → forward whip → settle.
      let x = restX;
      let z = restZ;
      if (u < 0.35) {
        const e = 1 - (1 - u / 0.35) ** 2;
        x = restX - 0.15 * e;
        z = restZ + tilt * e;
      } else if (u < 0.7) {
        const e = ((u - 0.35) / 0.35) ** 2;
        x = restX - 0.15 + (SCREAM_DELTA + 0.15) * e;
        z = restZ + tilt * (1 - e * 0.35);
      } else {
        const e = 1 - (1 - (u - 0.7) / 0.3) ** 2;
        x = restX + SCREAM_DELTA * (1 - e);
        z = restZ + tilt * (1 - e);
      }
      root.rotation.x = x;
      if (typeof root.rotation.z === "number") root.rotation.z = z;
    } else {
      const wave = u < 0.32 ? u / 0.32 : 1 - (u - 0.32) / 0.68;
      const eased = 1 - (1 - wave) * (1 - wave);
      root.rotation.x = restX + (peak - restX) * eased;
    }
    if (u < 1 && host.__karenHitUntil && now < host.__karenHitUntil + 32) {
      requestAnimationFrame(tick);
      return;
    }
    root.rotation.x = restX;
    if (typeof root.rotation.z === "number") root.rotation.z = restZ;
  };
  requestAnimationFrame(tick);
  return true;
}
